import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { config } from './config';

const userPool = new CognitoUserPool({
  UserPoolId: config.USER_POOL_ID,
  ClientId: config.USER_POOL_CLIENT_ID,
});

/** Sign up a new user with email and password. */
export function signUp(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })];
    userPool.signUp(email, password, attrs, [], (err, result) => {
      if (err) return reject(err);
      resolve(result?.user.getUsername() ?? '');
    });
  });
}

/** Confirm sign up with verification code. */
export function confirmSignUp(email: string, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err);
      resolve(result as string);
    });
  });
}

/** Sign in and return the session. */
export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

/** Sign out the current user. */
export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

/** Get the current session if signed in. Returns null if not authenticated. */
export function getSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session);
    });
  });
}

/** Get the ID token JWT string, or null if not signed in. */
export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
}
