// "use client";
// import React, { useRef } from "react";
// import { Box, Button } from "grommet";
// import { apiFetch } from "@/lib/apiClient";

// const Toolbar = ({ editor }: { editor: any }) => {
//   if (!editor) return null;
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // Trigger file picker
//   const triggerFileUpload = () => fileInputRef.current?.click();

//   // Handle image upload
//   const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     const formData = new FormData();
//     formData.append("image", file);

//     try {
//       const data = await apiFetch("/upload/image", {
//         method: "POST",
//         body: formData,
//         headers: {}, // let browser set Content-Type
//       });

//       if (data?.success && data?.url) {
//         // Normalize relative URL
//         let imgUrl = data.url;
//         if (imgUrl.startsWith("/uploads")) {
//           const base = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "");
//           imgUrl = `${base}${imgUrl}`;
//         }

//         editor.chain().focus().setImage({ src: imgUrl }).run();
//       } else {
//         console.error("Upload failed:", data);
//         alert("Image upload failed!");
//       }
//     } catch (err) {
//       console.error("Upload error:", err);
//       alert("Image upload failed");
//     } finally {
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     }
//   };

//   // Insert image by URL
//   const addImageByUrl = () => {
//     const url = prompt("Enter image URL");
//     if (url) editor.chain().focus().setImage({ src: url }).run();
//   };

//   // Insert table
//   const addTable = () => {
//     editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
//   };

//   return (
//     <Box direction="row" gap="small" margin={{ bottom: "small" }} wrap>
//       <Button label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} />
//       <Button label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} />

//       <Button label="Upload Image" onClick={triggerFileUpload} />
//       <Button label="Insert URL" onClick={addImageByUrl} />

//       <Button label="Insert Table" onClick={addTable} />

//       <input
//         ref={fileInputRef}
//         type="file"
//         accept="image/*"
//         style={{ display: "none" }}
//         onChange={handleFileChange}
//       />
//     </Box>
//   );
// };

// export default Toolbar;
