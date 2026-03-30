"use client";

import dynamic from "next/dynamic";

// Load CreateDocument *only* in the browser, no SSR at all
const CreateDocument = dynamic(() => import("./CreateDocument"), {
  ssr: false,
});

export default function Page() {
  return <CreateDocument />;
}
