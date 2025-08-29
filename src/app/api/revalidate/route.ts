import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// This is your secret token. Keep it safe and change it to something unique.
const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN;

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (token !== REVALIDATE_TOKEN) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    // Revalidate the homepage
    revalidatePath('/');
    // Revalidate the main performers list page
    revalidatePath('/performers');
    
    // You can also revalidate specific performer pages if needed,
    // but the two above will solve the main problem.
    
    console.log("Successfully revalidated paths: /, /performers");
    return NextResponse.json({ revalidated: true });
  } catch (err) {
    console.error("Error revalidating cache:", err);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}