
import { init, cert, getApp, App, AppOptions } from 'firebase-admin/app';

let adminApp: App;

try {
  adminApp = getApp();
} catch (error) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT environment variable is not set. Please ensure it is correctly defined in your .env file and that the development server was restarted.');
  }

  const credentials = JSON.parse(serviceAccount);
  const options: AppOptions = {
    credential: cert(credentials),
  };
  adminApp = init(options, 'default');
}

export { adminApp };
