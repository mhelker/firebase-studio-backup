import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// This runs on the secure server, so it can access the secret token.
const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN;

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (token !== REVALIDATE_TOKEN) {
    console.error("Invalid revalidation token received.");
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    revalidatePath('/');
    revalidatePath('/performers');
    
    console.log("Successfully revalidated paths: /, /performers");
    return NextResponse.json({ revalidated: true });
  } catch (err) {
    console.error("Error during revalidation:", err);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}