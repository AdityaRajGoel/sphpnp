import { motion, Variants } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

// Reveals a heading word-by-word as it scrolls into view.
// Renders inline spans so it drops into any <h2>/<h3> without changing layout.
const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

type Props = {
  text: string;
  className?: string;
};

export const RevealText = ({ text, className }: Props) => {
  const words = text.split(" ");
  return (
    <motion.span
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {words.map((w, i) => (
        <motion.span key={`${w}-${i}`} variants={word} className="inline-block">
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.span>
  );
};

export default RevealText;
