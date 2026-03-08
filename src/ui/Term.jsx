import HelpHover from "./HelpHover.jsx";

export default function Term({ t, terms, children }) {
  const key = t.toLowerCase();
  const definition = terms[t] || terms[key];
  return <HelpHover term={t} definition={definition}>{children || t}</HelpHover>;
}
