import { WorkspacePreview } from "blockwright";

// A scripted replay of a real generation: the prompt, the build steps as they
// land, the file tree filling, CurrencyService.luau typing itself out, and the
// approval gate at the end. It is time-driven (an IntersectionObserver starts a
// timer on first view), so a still capture shows the opening frame — three files
// present, the first step done, the next one spinning — rather than the settled
// panel. The file tree column only appears at lg and above.
export const BuildInProgress = () => <WorkspacePreview />;
