// First, and deliberately: registering the mock's routes and building its store
// are module side effects, and nothing below may dispatch a request before they
// have run. `lib/api.ts` imports the handler barrel for the same reason; both
// reach the same module instance, so this line costs a console banner and
// nothing else.
import "./demo";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);

// index.html paints a splash inside #root so the first frame is the shop's own
// cream rather than a white flash. `createRoot().render()` schedules the first
// commit rather than performing it, and React does not clear a container it did
// not fill, so the splash has to be removed by hand — one frame later, once
// there is something underneath it to see.
requestAnimationFrame(() => document.querySelector(".boot-splash")?.remove());
