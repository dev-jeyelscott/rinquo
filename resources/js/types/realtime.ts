/**
 * Public Reverb connection details shared by the server at runtime, so one
 * built image can serve every environment. Never contains the app secret.
 */
export type RealtimeConfig = {
    key: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
};
