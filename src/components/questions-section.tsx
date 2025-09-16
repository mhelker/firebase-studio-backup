"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context"; 
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export function QuestionsSection() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // fetch questions
  useEffect(() => {
    const q = query(
      collection(db, "questions"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuestions(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // submit question
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to ask a question.");
      return;
    }
    if (!question.trim()) return;

    await addDoc(collection(db, "questions"), {
      question,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      status: "open",
    });

    setQuestion("");
  };

  return (
    <section className="w-full p-4 border rounded-lg bg-secondary/20">
      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <Textarea
          placeholder="What's your question?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mb-2 bg-background"
        />
        <Button type="submit" className="w-full" disabled={!user}>
          {user ? "Submit Question" : "Login to Ask"}
        </Button>
      </form>
    </section>
  );
}
