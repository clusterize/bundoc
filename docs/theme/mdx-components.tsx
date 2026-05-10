import { Callout } from "./components/Callout";
import { Steps, Step } from "./components/Steps";

// MDX tag overrides + components MDX authors can use directly. Styling for
// the raw HTML tags lives in theme/styles.css under `.bundoc-prose`.
const components = {
  // Author components — drop-in for MDX authors via <Callout>, <Steps>, etc.
  Callout,
  Steps,
  Step,
};

export default components;
