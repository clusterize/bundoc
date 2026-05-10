import { Callout } from "./components/Callout";
import { Steps, Step } from "./components/Steps";
import { Pre } from "./components/Pre";

const components = {
  // Wrap <pre> so Shiki output gets a Copy button overlay and a filename
  // tab when the fence sets `title="…"`.
  pre: Pre,
  // Components MDX authors can use directly.
  Callout,
  Steps,
  Step,
};

export default components;
