// ScrollBar is rendered by ScrollArea itself, so its only true render is inside
// an overflowing ScrollArea — one cell per content shape it has to sit beside.
export {
  ProjectFileTree as BesideAFileList,
  LongCode as BesideCode,
} from "./ScrollArea";
