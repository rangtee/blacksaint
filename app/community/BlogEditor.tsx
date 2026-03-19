"use client";
import React, { useMemo, useRef } from 'react';
// @ts-ignore
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
// @ts-ignore
import ImageUploader from 'quill-image-uploader';
import { supabase } from '../../lib/supabase';

Quill.register('modules/imageUploader', ImageUploader);

interface BlogEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function BlogEditor({ value, onChange, placeholder }: BlogEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
    },
    imageUploader: {
      upload: (file: File) => {
        return new Promise(async (resolve, reject) => {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('community')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from('community')
              .getPublicUrl(filePath);

            resolve(urlData.publicUrl);

          } catch (error: any) {
            console.error('이미지 업로드 에러:', error);
            reject('업로드 실패');
            alert('이미지 업로드에 실패했습니다. 파일 형식을 확인해주세요.');
          }
        });
      },
    },
  }), []);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
    'color', 'background', 'list', 'link', 'image'
  ];

  return (
    // 🌟 다크 모드에서도 항상 하얀색 배경과 검은 글씨 유지하도록 고정!
    <div className="bg-white rounded-xl overflow-hidden text-slate-900 mt-2 border border-slate-200">
      <ReactQuill 
        ref={quillRef}
        theme="snow" 
        value={value} 
        onChange={onChange} 
        modules={modules}
        formats={formats}
        placeholder={placeholder || '부원들과 나누고 싶은 이야기를 들려주세요 (사진 첨부 가능)'}
        className="h-80 blog-editor"
      />
      <style jsx global>{`
        .blog-editor .ql-container {
          padding-bottom: 50px;
          /* 작성하는 글씨가 다크모드에서 하얗게 뜨는 것 방지 */
          color: #0f172a !important; 
        }
        /* 에디터 툴바 항상 밝은 색상 유지 */
        .ql-toolbar.ql-snow {
          border-bottom: 1px solid #e2e8f0 !important;
          background-color: #f8fafc !important;
        }
        /* 다크모드에서 툴바 아이콘/텍스트가 하얗게 변하는 것 강제 방지 */
        .dark .ql-toolbar.ql-snow .ql-picker-label {
           color: #444 !important;
        }
        .dark .ql-toolbar.ql-snow .ql-stroke {
           stroke: #444 !important;
        }
        .dark .ql-toolbar.ql-snow .ql-fill {
           fill: #444 !important;
        }
      `}</style>
    </div>
  );
}