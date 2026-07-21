# 정보보안기사 시험대비

React + TypeScript + Vite로 만든 정적 문제풀이 사이트입니다.

## 로컬 실행

```bash
pnpm install
pnpm run dev
```

## 빌드

```bash
pnpm run build
```

## 데이터 재생성

`security-exam-reference.pdf`를 기준으로 시험 데이터를 다시 추출합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
pnpm run extract
```

## 배포

`main` 브랜치에 push되면 GitHub Actions가 `dist`를 빌드하고 GitHub Pages로 배포합니다.

배포 URL:

```text
https://kelvin-tripleauth.github.io/security-exam/
```
