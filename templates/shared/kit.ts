/**
 * A "kit" is the set of class names a theme uses for the shared content
 * sections. Themes differ in layout (header/footer/hero) and in their kit;
 * the content sections themselves are shared so every theme renders the
 * same LodgeSiteData.
 */
export interface ThemeKit {
  main: string;
  section: string;
  h1: string;
  h2: string;
  h3: string;
  card: string;
  button: string;
  link: string;
  muted: string;
  prose: string;
  badge: string;
  calendarCell: string;
  calendarCellMuted: string;
  calendarEvent: string;
}
