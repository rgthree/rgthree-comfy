"""Some basic config stuff I use for SDXL."""

from .constants import get_category, get_name
from nodes import MAX_RESOLUTION
import comfy.samplers


class RgthreeSDXLConfig:
  """Some basic config stuff I use for SDXL."""

  NAME = get_name('SDXL Config')
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {
        "steps_total": ("INT", {
          "default": 30,
          "min": 1,
          "max": MAX_RESOLUTION
        }),
        "refiner_step": ("INT", {
          "default": 24,
          "min": 1,
          "max": MAX_RESOLUTION
        }),
        "sampler_name": (comfy.samplers.KSampler.SAMPLERS,),
        "scheduler": (comfy.samplers.KSampler.SCHEDULERS,),
        #"refiner_ascore_pos": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 1000.0, "step": 0.01}),
        #"refiner_ascore_neg": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 1000.0, "step": 0.01}),
      },
    }

  RETURN_TYPES = ("INT", "INT", comfy.samplers.KSampler.SAMPLERS,
                  comfy.samplers.KSampler.SCHEDULERS)
  RETURN_NAMES = ("STEPS", "REFINER_STEP", "SAMPLER", "SCHEDULER")
  FUNCTION = "main"

  def main(self, steps_total, refiner_step, sampler_name, scheduler):
    """main"""
    return (
      steps_total,
      refiner_step,
      sampler_name,
      scheduler,
    )
