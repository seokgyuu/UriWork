/**
 * 스토리지 서비스 모듈
 * Firebase Storage를 사용한 파일 업로드/다운로드 기능
 * 이미지, 문서 등 파일 관리
 * 업로드 진행률 추적 및 에러 처리
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

// 파일 업로드 함수
export const uploadFile = async (file, path) => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('파일 업로드 에러:', error);
    throw error;
  }
};

// 프로필 이미지 업로드
export const uploadProfileImage = async (file, userId) => {
  const path = `profile-images/${userId}/${Date.now()}_${file.name}`;
  return await uploadFile(file, path);
};

// 파일 삭제 함수
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log('파일 삭제 완료:', path);
  } catch (error) {
    console.error('파일 삭제 에러:', error);
    throw error;
  }
};

// URL에서 파일 경로 추출
export const getFilePathFromURL = (url) => {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.split('/o/')[1];
    return decodeURIComponent(path);
  } catch (error) {
    console.error('URL에서 파일 경로 추출 에러:', error);
    return null;
  }
}; 