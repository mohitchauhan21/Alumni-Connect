/**
 * A mentor's own Google Meet room, e.g. https://meet.google.com/abc-defg-hij.
 *
 * Only standard meeting codes are accepted (three letters, four, three), so the link can never point
 * anywhere but a Meet room. People paste it in many shapes — with or without https://, with a
 * trailing slash or ?query, in capitals — so it's normalised to one canonical form first.
 */
const CODE = /^(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?(?:[?#].*)?$/i;

/** The canonical https://meet.google.com/xxx-xxxx-xxx link, or null if it isn't a Meet room link. */
export function normalizeMeetLink(input: string): string | null {
  const m = CODE.exec(input.trim());
  return m ? `https://meet.google.com/${m[1].toLowerCase()}` : null;
}

export const isMeetLink = (url: string | null | undefined) => !!url && url.startsWith('https://meet.google.com/');
