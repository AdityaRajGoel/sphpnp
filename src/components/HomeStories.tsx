import FeatureStory from "@/components/FeatureStory";
import { HOME_STORIES } from "@/data/feature-stories";

/** Lazy-loaded home section: the illustrated "how we help" rows. */
export default function HomeStories() {
  return (
    <FeatureStory
      id="how-we-help"
      eyebrow="Beyond the tools"
      heading="How our Panipat branch helps you invest"
      intro="Research and technology do the heavy lifting; our team makes sure every decision fits you."
      items={HOME_STORIES}
    />
  );
}
