"""Streaming video object segmentation on top of SAM 2.

One TrackSession follows ONE selected object through a live camera: start() takes the first frame and the outline the
person chose, step() takes each new frame and returns the object's mask in it. SAM 2 keeps a memory of the object's
recent appearance, so it follows rotation, tilt, approach and short occlusions that a color template cannot.
The upstream predictor wants a whole video up front; here frames arrive one by one, so `images` is a tiny frame store
and only the newest few frames' memory is kept (bounded memory, same results as upstream for the frames it still uses).
"""
import cv2
import numpy as np
import torch

KEEP = 9          # frames of memory kept (SAM 2 reads at most 7 previous frames)
MEAN = torch.tensor([.485, .456, .406])[None, :, None, None]
STD = torch.tensor([.229, .224, .225])[None, :, None, None]


class FrameStore:
    """Looks like the list of frames the predictor indexes, but only holds the newest ones."""
    def __init__(self):
        self.frames = {}

    def __getitem__(self, i):
        return self.frames[i]

    def drop_before(self, i):
        for k in [k for k in self.frames if k < i]:
            del self.frames[k]


def ring_mask(rings, h, w):
    seed = np.zeros((h, w), dtype="uint8")
    paths = [np.int32([[round(pt["x"] * (w - 1)), round(pt["y"] * (h - 1))] for pt in ring]) for ring in rings]
    cv2.fillPoly(seed, paths, 1)   # even-odd fill keeps holes
    return seed


class TrackSession:
    def __init__(self, model, rgb, seed):
        self.model, self.h, self.w = model, rgb.shape[0], rgb.shape[1]
        self.count0 = int(seed.sum())
        self.store = FrameStore()
        self.idx = 0
        self.state = dict(images=self.store, num_frames=1, video_height=self.h, video_width=self.w, device=model.device,
                          storage_device=model.device, offload_video_to_cpu=True, offload_state_to_cpu=False, obj_ids=[],
                          **{k: {} for k in ("point_inputs_per_obj", "mask_inputs_per_obj", "cached_features", "constants",
                                             "obj_id_to_idx", "obj_idx_to_id", "output_dict_per_obj", "temp_output_dict_per_obj",
                                             "frames_tracked_per_obj")})
        self.store.frames[0] = self._tensor(rgb)
        model.add_new_mask(self.state, frame_idx=0, obj_id=1, mask=seed)
        for _ in model.propagate_in_video(self.state, start_frame_idx=0, max_frame_num_to_track=0):
            pass
        self.last_area = self.count0

    def _tensor(self, rgb):
        size = self.model.image_size
        x = torch.from_numpy(cv2.resize(rgb, (size, size), interpolation=cv2.INTER_LINEAR)).permute(2, 0, 1).float().div_(255)
        return x.sub_(MEAN[0]).div_(STD[0])

    def step(self, rgb):
        """-> (mask bool HxW or None, present score). None when the object is lost."""
        if rgb.shape[:2] != (self.h, self.w):
            return None, -9.0
        self.idx += 1
        i = self.idx
        self.store.frames[i] = self._tensor(rgb)
        self.state["num_frames"] = i + 1
        mask = None
        for fi, _, logits in self.model.propagate_in_video(self.state, start_frame_idx=i, max_frame_num_to_track=0):
            if fi == i:
                mask = (logits[0, 0].float().cpu().numpy() > 0)
        out = self.state["output_dict_per_obj"][0]["non_cond_frame_outputs"].get(i)
        present = float(out["object_score_logits"].flatten()[0]) if out is not None and "object_score_logits" in out else 0.0
        self._prune(i)
        if mask is None:
            return None, present
        area = int(mask.sum())
        # lost: the model says the object is gone, or the mask collapsed / swallowed the frame
        if present < -1.0 or area < max(16, self.count0 * .05) or area > min(self.count0 * 8, .92 * self.h * self.w):
            return None, present
        self.last_area = area
        return mask, present

    def _prune(self, i):
        cut = i - KEEP
        self.store.drop_before(cut + 1)
        for d in self.state["output_dict_per_obj"].values():
            for key in ("non_cond_frame_outputs",):
                for k in [k for k in d[key] if k < cut]:
                    del d[key][k]
        for d in self.state["frames_tracked_per_obj"].values():
            for k in [k for k in d if k < cut]:
                del d[k]
        self.state["cached_features"] = {}
