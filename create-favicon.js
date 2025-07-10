import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

// __dirname 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canvas를 사용하여 간단한 ICO 파일 생성
async function createFavicon() {
  try {
    // 파비콘 크기 설정
    const sizes = [16, 32, 48];
    
    // ICO 파일 헤더 생성
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // 예약됨, 항상 0
    header.writeUInt16LE(1, 2); // 이미지 타입 1 = ICO
    header.writeUInt16LE(sizes.length, 4); // 이미지 수
    
    let directory = Buffer.alloc(16 * sizes.length);
    let offset = 6 + 16 * sizes.length;
    let data = [];
    
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      
      // Canvas 생성
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // 배경
      ctx.fillStyle = '#1a202c';
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
      
      // 테두리
      ctx.strokeStyle = '#a0aec0';
      ctx.lineWidth = size/16;
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - size/32, 0, Math.PI * 2);
      ctx.stroke();
      
      // 방패 그리기
      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.moveTo(size/4, size/3);
      ctx.lineTo(size*3/4, size/3);
      ctx.lineTo(size*3/4, size*2/3);
      ctx.arc(size/2, size*2/3, size/4, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      
      // 방패 문양
      ctx.fillStyle = '#d69e2e';
      ctx.beginPath();
      ctx.moveTo(size/2, size*0.4);
      ctx.lineTo(size*0.6, size/2);
      ctx.lineTo(size/2, size*0.7);
      ctx.lineTo(size*0.4, size/2);
      ctx.closePath();
      ctx.fill();
      
      // PNG 데이터로 변환
      const pngData = canvas.toBuffer('image/png');
      
      // ICO 디렉토리 항목 작성
      directory.writeUInt8(size, i * 16); // 너비
      directory.writeUInt8(size, i * 16 + 1); // 높이
      directory.writeUInt8(0, i * 16 + 2); // 색상 팔레트 수 (0 = 256색)
      directory.writeUInt8(0, i * 16 + 3); // 예약됨, 항상 0
      directory.writeUInt16LE(1, i * 16 + 4); // 색상 플레인 (항상 1)
      directory.writeUInt16LE(32, i * 16 + 6); // 비트 깊이
      directory.writeUInt32LE(pngData.length, i * 16 + 8); // 이미지 데이터 크기
      directory.writeUInt32LE(offset, i * 16 + 12); // 이미지 데이터 오프셋
      
      offset += pngData.length;
      data.push(pngData);
    }
    
    // 모든 버퍼 결합
    const ico = Buffer.concat([header, directory, ...data]);
    
    // 파일로 저장
    fs.writeFileSync(path.join(__dirname, 'public', 'favicon.ico'), ico);
    console.log('favicon.ico 파일이 생성되었습니다.');
    
  } catch (error) {
    console.error('파비콘 생성 중 오류 발생:', error);
  }
}

createFavicon(); 