/**
 * @fileoverview This file contains the configuration for admin users.
 * To add an admin, add their Firebase Authentication UID to the array.
 */

// IMPORTANT: Replace this placeholder with your actual Firebase User ID (UID).
// You can find your UID in the Firebase console under Authentication > Users.
export const ADMIN_USER_IDS = [
    'csW7YstynkakD51lTaqJjlRuSCp2',
];

/**
 * Checks if a given user ID belongs to an admin.
 * @param uid The user ID to check.
 * @returns True if the user is an admin, false otherwise.
 */
export function isAdmin(uid: string | undefined): boolean {
    if (!uid) {
        return false;
    }
    return ADMIN_USER_IDS.includes(uid);
}
