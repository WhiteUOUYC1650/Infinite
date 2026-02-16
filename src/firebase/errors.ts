export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    context: SecurityRuleContext;

    constructor(context: SecurityRuleContext) {
        const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(context, null, 2)}`;
        super(message);
        this.name = 'FirestorePermissionError';
        this.context = context;
        // This is to make the error visible in the Next.js overlay
        if (typeof window !== 'undefined') {
            // No longer throwing automatically, will be displayed in a toast.
            // setTimeout(() => {
            //     throw this;
            // }, 0);
        }
    }
}
