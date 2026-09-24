/** What client components may know about the signed-in user. */
export interface Viewer {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  autoSaveScans: boolean;
  savePhotos: boolean;
  createdAt: string;
}
