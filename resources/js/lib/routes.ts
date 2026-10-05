/** Fixed Owner entry points. Settings tab URLs come from the server (baseUrl). */
export const ownerRoutes = {
    login: '/owner/auth/login',
    requestCode: '/owner/auth/code',
    verifyCode: '/owner/auth/verify',
    restart: '/owner/auth/restart',
    logout: '/owner/auth/logout',
    onboarding: '/owner/onboarding',
} as const;
