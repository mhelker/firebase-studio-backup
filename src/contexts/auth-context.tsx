
"use client";

import type { User as FirebaseUser, AuthError } from "firebase/auth";
import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  type ReactNode 
} from "react";
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import type { Customer } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  imageUrl: string | null; // Add imageUrl to the context
  signUp: (email: string, pass: string) => Promise<FirebaseUser | null>;
  logIn: (email: string, pass: string) => Promise<FirebaseUser | null>;
  logOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAuthErrorMessage = (error: AuthError): string => {
    switch (error.code) {
        case 'auth/wrong-password':
            return "Invalid password. Please try again.";
        case 'auth/user-not-found':
             return "No account found with this email. Please sign up first.";
        case 'auth/email-already-in-use':
            return "An account already exists with this email address.";
        case 'auth/invalid-credential':
            return "The email or password you entered is incorrect.";
        case 'auth/network-request-failed':
            return "Network error. Please check your connection and try again.";
        case 'auth/api-key-not-valid':
        case 'auth/invalid-api-key':
            return "The API Key in src/lib/firebase.ts is not valid. If you just pasted your keys, please restart the development server to apply the changes.";
        case 'auth/app-deleted':
        case 'auth/app-not-authorized':
        case 'auth/invalid-app-credential':
             return "Firebase authentication is not correctly configured for this app. Please check your project settings.";
        case 'auth/configuration-not-found':
             return "The Firebase configuration is invalid. Please check the values in src/lib/firebase.ts.";
        default:
            return error.message || "An unexpected error occurred. Please try again.";
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthError("Firebase is not configured. Please add your API keys to src/lib/firebase.ts");
      setLoading(false);
      return;
    }

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => authUnsubscribe();
  }, []);
  
  // New effect to listen for customer profile changes
  useEffect(() => {
    if (user) {
        const customerDocRef = doc(db, "customers", user.uid);
        const customerUnsubscribe = onSnapshot(customerDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const customerData = docSnap.data() as Customer;
                setImageUrl(customerData.imageUrl || null);
            } else {
                setImageUrl(null);
            }
        }, (error) => {
            console.error("Failed to listen to customer profile:", error);
            setImageUrl(null);
        });

        return () => customerUnsubscribe();
    } else {
        // Clear image URL on logout
        setImageUrl(null);
    }
  }, [user]);

  const handleError = (error: AuthError) => {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      if (!message.includes('API Key') && !message.includes('configuration')) {
           toast({ 
              title: "Authentication Error", 
              description: message, 
              variant: "destructive"
          });
      }
      return null;
  }
  
  const handleGenericError = (error: any, defaultMessage: string): false => {
      const authError = error as AuthError;
      const message = getAuthErrorMessage(authError);
      toast({ 
          title: "Error", 
          description: message || defaultMessage, 
          variant: "destructive" 
      });
      return false;
  }

  const signUp = async (email: string, password: string): Promise<FirebaseUser | null> => {
    if (!auth || !db) return null;
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      const customerDocRef = doc(db, "customers", newUser.uid);
      await setDoc(customerDocRef, {
        id: newUser.uid,
        displayName: newUser.email?.split('@')[0] || `User ${newUser.uid.substring(0, 5)}`,
        imageUrl: newUser.photoURL || '',
        rating: 0,
        reviewCount: 0,
        createdAt: serverTimestamp(),
      });
      
      toast({ 
          title: "Account Created!", 
          description: "You've successfully signed up. You can now book talent or create a performer profile from your profile page." 
      });
      
      router.push("/");
      return newUser;
    } catch (error) {
      return handleError(error as AuthError);
    }
  };

  const logIn = async (email: string, password: string): Promise<FirebaseUser | null> => {
    if (!auth) return null;
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Logged In!", description: "Welcome back!" });
      router.push("/");
      return userCredential.user;
    } catch (error) {
      return handleError(error as AuthError);
    }
  };

  const logOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You've been successfully logged out." });
      router.push("/");
    } catch (error) {
      handleGenericError(error, "Could not log out.");
    }
  };
  
  const sendPasswordReset = async (email: string): Promise<boolean> => {
      if (!auth) return false;
      try {
          await sendPasswordResetEmail(auth, email);
          return true;
      } catch (error) {
          return handleGenericError(error, "Could not send password reset email.");
      }
  };

  const value = { user, loading, signUp, logIn, logOut, authError, sendPasswordReset, imageUrl };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
