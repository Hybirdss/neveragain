
地震 AI システム
EARTHQUAKE AI SYSTEM FOR JAPAN


데이터 수집 계획 및 출처 조사 보고서
Data Collection Plan & Source Investigation Report

2026년 3월

1. 개요 (Executive Summary)
일본은 태평양판, 필리핀해판, 북미판, 유라시아판 등 4개 판이 교차하는 세계에서 가장 지진 활동이 활발한 국가 중 하나이다. 전국에 2,000개 이상의 활성단층이 분포하며, 난카이 트러프 등 대규모 지진 발생 위험이 상존한다. 본 보고서는 일본 지진 AI 시스템 구축을 위해 수집해야 할 핵심 데이터, 그 출처, 그리고 구체적인 수집 방법을 상세히 정리한다.
AI 기반 지진 시스템은 크게 다섯 가지 핵심 기능으로 구성된다: (1) 지진 감지 및 조기경보 (EEW), (2) 지진동 예측 (Ground Motion Prediction), (3) 지진 발생 확률 예측 (Seismicity Forecasting), (4) 쓰나미 예측 및 경보, (5) 피해 평가 및 대응. 각 기능별로 필요한 데이터의 종류와 특성이 다르며, 본 보고서는 이를 체계적으로 분류하여 제시한다.
2. 지진파 파형 데이터 (Seismic Waveform Data)
지진파 파형 데이터는 AI 지진 시스템의 가장 기본적이고 핵심적인 데이터이다. P파와 S파의 감지, 진도 예측, 진원 결정 등 거의 모든 AI 모델의 기초 입력값이 된다. 일본은 세계 최대 규모의 지진 관측망인 MOWLAS를 운영하고 있으며, 이는 육상과 해저 약 2,100개 관측점을 포괄한다.
2.1 NIED MOWLAS 관측망
NIED(National Research Institute for Earth Science and Disaster Resilience)가 운영하는 MOWLAS는 2017년 11월부터 통합 운영을 시작한 세계 최대 규모의 지진·쓰나미·화산 관측 통합 네트워크이다.
네트워크
설명
관측점 수
URL / 데이터 접근
Hi-net
(고감도 지진계망)
지하 100m 이상 보어홀 하부에 설치된 고감도 지진계. 인간이 느끼지 못하는 미세 지진까지 감지 가능.
약 800개소
https://www.hinet.bosai.go.jp/
계정 등록 후 다운로드 가능
Python: HinetPy 패키지 활용
K-NET
(강진동 관측망)
전국 지표면에 설치된 강진동 지진계. 파괴적인 강한 지진동 기록에 특화.
약 1,000개소
https://www.kyoshin.bosai.go.jp/
무료 공개, 계정 등록 필요
KiK-net
(기반 강진동망)
Hi-net 관측점에 지표면/지하 쌍으로 설치된 강진동 지진계. 지반 증폭 효과 연구에 핵심.
약 700개소
K-NET과 동일 포털에서 접근
https://www.kyoshin.bosai.go.jp/
F-net
(광대역 지진계망)
전국 약 70개소에 설치된 광대역 지진계. 원거리 지진의 느린 지반운동을 정밀 감지.
약 70개소
NIED 데이터 센터 통해 접근
Moment Tensor 카탈로그 제공
S-net
(해저 관측망)
홍카이도~보소반도 앞바다 해저에 설치. 지진계+수압계 조합으로 지진과 쓰나미 동시 관측.
150개소
NIED MOWLAS 포털
https://www.mowlas.bosai.go.jp/
DONET
(조밀 해저망)
난카이 트러프 부근 해저에 설치. 쿠마노나다/기이반도 앞바다 관측.
51개소
NIED MOWLAS 포털
원래 JAMSTEC에서 2016년 NIED로 이관
V-net
(화산 관측망)
16개 화산에 설치된 지진계/GPS/경사계 등 복합 관측.
16개 화산
NIED MOWLAS 포털


데이터 수집 방법
NIED 웹사이트에서 무료 계정 등록 후 데이터 다운로드 (재배포 금지 조건 준수 필요)
Hi-net 데이터는 HinetPy Python 패키지를 통해 자동화된 다운로드 및 처리 가능
K-NET/KiK-net 데이터는 이벤트별 또는 기간별 다운로드 지원
실시간 데이터는 EarthLAN(IP-VPN) 통해 0.5초 이하 지연으로 JMA에 전송 — 기관 협력 필요
데이터 포맷: WIN32 포맷(연속 파형), SAC/ASCII(이벤트 파형)
3. 지진 카탈로그 데이터 (Earthquake Catalog)
지진 카탈로그는 과거 지진의 발생 시간, 위치, 깊이, 규모, 메커니즘 등을 체계적으로 기록한 데이터베이스이다. 지진 발생 패턴 학습, 여진 예측, 지진 활동 분석 등에 필수적이다.
출처
설명
커버리지
접근 방법
JMA 지진 카탈로그
(Japan Meteorological Agency)
1923년부터의 일본 및 주변 지진 목록. 진원, 규모, 깊이, 진도 등 포함. 일본 지진 연구의 기본 카탈로그.
일본 및 주변
1923~현재
https://www.data.jma.go.jp/eqev/data/bulletin/
The Seismological Bulletin of Japan
무료 공개
USGS Earthquake Catalog
(미국 지질조사국)
전 세계 지진 카탈로그. REST API 제공으로 자동화된 데이터 수집 용이.
전 세계
M2.5+
https://earthquake.usgs.gov/fdsnws/event/1/
REST API 제공
GeoJSON/CSV/XML 포맷
ISC Bulletin
(International Seismological Centre)
전 세계 지진관 데이터를 통합한 국제 카탈로그. 재결정된 정밀 진원 정보 제공.
전 세계
1900년대~
http://www.isc.ac.uk/
웹 검색 및 다운로드
NIED 지진 카탈로그
Hi-net 기반 자동 결정 진원 목록. AQUA 시스템에 의한 실시간 자동 결정.
일본 전역
Hi-net 웹사이트에서 제공
Global CMT Catalog
전 세계 지진의 Centroid Moment Tensor 해 제공. 단층 메커니즘 분석에 필수.
전 세계
M5+
https://www.globalcmt.org/
무료 공개

4. GNSS/측지 데이터 (Geodetic Data)
GNSS(범지구 항법위성시스템) 데이터는 지각 변동, 판 경계 운동, 느린 미끄럼지진(slow slip) 감지 등에 핵심적인 데이터이다. 지진 전조 현상 포착과 지진 후 변형 분석에 활용된다.
4.1 GEONET (국토지리원 GNSS 망)
운영: GSI (Geospatial Information Authority of Japan, 국토지리원)
관측점: 전국 약 1,300개소의 전자기준점
데이터: 일별 좌표 변화량 (F3/F5 해), 30초 샘플링 RINEX 데이터
접근: https://www.gsi.go.jp/ENGLISH/geonet_english.html
신청 방법: IP 주소를 포함한 신청서를 gsi-dataprov_1@gxb.mlit.go.jp로 제출 후 FTP 접근 받음
활용: 2011년 동일본대지진 시 최대 5.3m 수평변위 감지 실적
4.2 InSAR 위성 레이더 데이터
InSAR(Interferometric Synthetic Aperture Radar)는 위성 SAR 영상의 위상 차이를 이용해 mm 단위의 지표 변형을 측정하는 기술이다. 단층 활동 모니터링, 지진 전후 변형 분석, 느린 미끄럼지진 감지에 활용된다.
위성/플랫폼
운영 기관
특징
데이터 접근
ALOS-2 (PALSAR-2)
JAXA (일본)
L-밴드 SAR. 산악/식생 지역 투과력 우수.
JAXA AUIG2
https://www.eorc.jaxa.jp/ALOS-2/
Sentinel-1A/C
ESA (유럽)
C-밴드 SAR. 6~12일 재방문 주기. 무료 공개.
Copernicus Open Access Hub
https://scihub.copernicus.eu/
COSMO-SkyMed
ASI (이탈리아)
X-밴드 SAR. 고해상도 관측 가능.
ASI 데이터 신청 필요

5. 지질·단층 데이터 (Geological & Fault Data)
단층 위치, 활동 이력, 지질 구조 등의 데이터는 지진 발생 확률 평가와 지진동 예측 모델에 필수적이다.
데이터 종류
출처
설명
접근 방법
활성단층 데이터베이스
AIST
(National Institute of Advanced Industrial Science and Technology)
일본 전국 2,000개 이상의 활성단층 정보. 위치, 길이, 재현주기, 변위량 등.
https://gbank.gsj.jp/activefault/
무료 공개
지진 해저드 맵
J-SHIS
(Japan Seismic Hazard Information Station)
확률론적 지진동 예측도. 지역별 위험도 및 수치 데이터 다운로드 가능.
https://www.j-shis.bosai.go.jp/
GIS 데이터 및 API 제공
지질도
GSJ
(Geological Survey of Japan)
일본 전국 지질도. 암종, 지층, 토양 특성 등.
https://www.gsj.jp/
디지털 지질도 무료 공개
지반 증폭 특성
NIED 500m 메쉬 데이터
지형분류에 기반한 500m 격자 단위의 지반 증폭 특성.
NIED 지진 데이터베이스
Vs30 값 포함
지구물리 탐사 데이터
JAMSTEC
해저 지형, 판 경계 구조, 해저 토모그래피 등.
https://www.jamstec.go.jp/
연구 협력 필요

6. 지반 및 토양 데이터 (Site & Soil Data)
지진동 예측의 정확도는 관측 지점의 지반 특성에 크게 의존한다. Vs30(지표면부터 30m 깊이까지의 평균 전단파 속도), 액상화 위험도, 지반 증폭 특성 등이 핵심 변수이다.
K-NET/KiK-net 관측점 보어홀 속도 프로파일: 전국 1,742개 관측점의 Vs30, 기반암 깊이, 속도 대비 등 포함 (open-source site database 공개)
J-SHIS 지반 모델: 전국 250m/500m 격자의 지반 증폭 특성 및 Vs30 분포도
시바우라공과대 3D 토양 분석 모델: 인공신경망과 앱상블 학습을 통한 액상화 위험도 평가 모델
USGS 글로벌 Vs30 맵: 지형 경사도 기반 전 세계 Vs30 추정치 제공
7. 쓰나미 데이터 (Tsunami Data)
일본 지진 AI 시스템에서 쓰나미 예측은 핵심 기능 중 하나이다. S-net과 DONET의 해저 수압계 데이터가 쓰나미 감지의 핵심이며, 추가적으로 다음 데이터가 필요하다.
데이터
출처
설명
해저 수압 관측 데이터
S-net / DONET (NIED)
150+51개 해저 관측점의 실시간 수압 변화 데이터
조위관측 데이터
JMA 조위관측소
일본 연안 조위 관측 기록
과거 쓰나미 기록
NOAA NCEI 쓰나미 DB
역사적 쓰나미 발생 기록, 파고, 침수 범위 등
해저 지형 데이터
GEBCO / JAMSTEC
쓰나미 시뮬레이션에 필수적인 고해상도 해저 지형도
쓰나미 침수 시뮬레이션 데이터
AIST / 내각부 중앙방재회의
난카이 트러프 등 예상 시나리오별 침수 예측 데이터

8. 위성 및 원격탐사 데이터 (Satellite & Remote Sensing)
위성 데이터는 대규모 지표 변형 모니터링, 지진 피해 평가, 느린 지진 감지 등에 활용된다. 최근 딥러닝 기반 InSAR 분석은 2mm 수준의 미세 변형까지 감지 가능하다.
Sentinel-1 (ESA): C-밴드 SAR, 무료 공개, 6~12일 재방문. Copernicus Open Access Hub에서 다운로드
ALOS-2 PALSAR-2 (JAXA): L-밴드 SAR, 일본 전역 고해상도 관측. JAXA 데이터 신청 필요
광학 영상 (Sentinel-2, Planet Labs): 지진 피해 평가, 건물 붕괴 감지, 산사태 분석 등에 활용
중력장 변화 (GRACE/GRACE-FO): NASA/DLR 운영. 대규모 지진 전후 중력장 변화 감지
9. 건물·인프라 데이터 (Building & Infrastructure)
지진 피해 예측 및 리스크 평가를 위해서는 건물과 인프라 정보가 필요하다.
국토교통성 건물 데이터: 건물 위치, 구조, 연식, 층수 등 포함한 대규모 데이터베이스
주택·토지 통계 조사 (총무성): 지역별 인구분포, 주택유형, 건축연도 등
라이프라인 정보: 고속도로, 철도, 가스라인, 전력망, 수도 등 기반 시설 위치 정보
과거 지진 피해 데이터: 각 지진별 건물 피해 조사 보고서 (NIED/JMA 제공)
10. 소셜·실시간 데이터 (Social & Real-time Data)
AI 시스템의 실시간 상황 파악과 신속한 대응을 위해 소셜미디어와 IoT 데이터를 활용할 수 있다. 일본의 Spectee Pro가 대표적인 사례이다.
SNS 데이터 (X/Twitter, LINE): 지진 체감 보고, 피해 상황 실시간 수집. X API 또는 크롤링 활용
Spectee Pro 모델: SNS, 기상 데이터, 도로/하천 카메라, 차량 데이터 등을 AI로 통합 분석하여 1분 이내 검증된 정보 배포
IoT 센서 데이터: 건물 구조 모니터링 센서, 스마트폰 가속도계 (MyShake 등)
CCTV/도로 카메라 영상: 컴퓨터 비전으로 피해 상황 자동 분석
11. 기상·환경 데이터 (Weather & Environmental)
JMA 기상 관측 데이터: 강우량, 기온, 기압 등 (지진 후 2차 재해 예측에 활용)
지하수위 데이터: 지진 전조 현상 연구용 (수위 변화와 응력 변화 상관관계)
전리층 데이터 (TEC): GNSS 기반 전리층 전자 밀도 변화 모니터링 (지진 전조 연구)
라돈(Radon) 농도 관측: 지하 라돈 농도 변화 모니터링 (실험적 지진 전조 지표)
12. AI 모델별 필요 데이터 요약
각 AI 기능별로 필요한 데이터를 정리한다.
AI 기능
핵심 데이터
주요 모델 유형
참고 연구
지진 감지 및 EEW
(조기경보)
P파 파형 초기 3초
관측점 좌표
진원거리
CNN + Transformer
(CT 아키텍처)
PhaseNet, EQTransformer
DFTQuake 모델
MAE 0.66 (JMA 단위)
진도/지진동 예측
(Ground Motion)
강진동 기록 (PGA, PGV)
지반 특성 (Vs30)
진원 파라미터
CNN 기반 GMPE
ANN 회귀 모델
NIED 2024 Noto
지진 분석 연구
여진/후속지진 예측
JMA 카탈로그 (1973~)
클러스터 분석 데이터
ETAS 모델 파라미터
NESTORE 알고리즘
하이브리드 ML
XGBoost
NESTORE: 정확도 0.94
6시간 후 예측
지각변동/느린지진 감지
GNSS 시계열
InSAR 시계열
지진파 연속기록
Deep Autoencoder
CNN (U-Net 기반)
Transformer
2mm 감지 성공
(Nature Comm. 2021)
쓰나미 예측
해저 수압 데이터
진원/규모 정보
해저 지형도
물리 기반 시뮬레이션
+ ML 보정 모델
S-net 활용으로
20분 조기경보 달성
피해 평가
위성 영상 (전/후)
SNS 데이터
건물 정보
CNN 객체 감지
이미지 세그멘테이션
NLP 분석
Spectee Pro
실시간 피해분석

13. 데이터 수집 로드맵
Phase 1: 기초 데이터 확보 (1~3개월)
NIED MOWLAS 전체 데이터 접근권 확보 (계정 등록 및 기관 협력 협의)
JMA 지진 카탈로그 전체 다운로드 (1923~현재)
USGS/ISC/Global CMT 카탈로그 API 연동 파이프라인 구축
K-NET/KiK-net 과거 강진동 기록 전체 다운로드
J-SHIS 지진 해저드 및 지반 데이터 확보
Phase 2: 확장 데이터 수집 (3~6개월)
GEONET GNSS 데이터 접근 신청 및 FTP 설정
Sentinel-1 InSAR 데이터 자동 다운로드 파이프라인 구축 (Copernicus Hub)
ALOS-2 PALSAR-2 데이터 JAXA 신청
AIST 활성단층 DB 및 GSJ 지질도 데이터 수집
GEBCO/JAMSTEC 해저지형 데이터 확보
Phase 3: 실시간 데이터 연동 (6~12개월)
NIED 실시간 파형 데이터 수신 시스템 구축 (EarthLAN 연동 협의)
SNS 실시간 모니터링 시스템 구축 (X API/크롤링)
IoT 센서 네트워크 연동 탐색
위성 영상 자동 처리 파이프라인 구축
14. 핵심 데이터 접근 URL 총정리
데이터원
URL
비고
MOWLAS 포털
https://www.mowlas.bosai.go.jp/
전체 관측망 통합 접근
Hi-net
https://www.hinet.bosai.go.jp/
고감도 지진파 데이터
K-NET/KiK-net
https://www.kyoshin.bosai.go.jp/
강진동 데이터
JMA 카탈로그
https://www.data.jma.go.jp/eqev/data/bulletin/
지진 목록
J-SHIS
https://www.j-shis.bosai.go.jp/
지진 해저드 맵
GEONET
https://www.gsi.go.jp/ENGLISH/geonet_english.html
GNSS 데이터
USGS API
https://earthquake.usgs.gov/fdsnws/event/1/
전 세계 카탈로그
AIST 활성단층
https://gbank.gsj.jp/activefault/
활성단층 DB
Copernicus Hub
https://scihub.copernicus.eu/
Sentinel-1 SAR 데이터
Global CMT
https://www.globalcmt.org/
Moment Tensor 카탈로그
NOAA 쓰나미 DB
https://www.ngdc.noaa.gov/hazard/tsu_db.shtml
역사적 쓰나미 기록
HinetPy (Python)
https://seisman.github.io/HinetPy/
Hi-net 데이터 자동화 도구




본 보고서는 일본 지진 AI 시스템 구축을 위한 데이터 수집 계획의 기초 자료로서, 각 데이터원의 접근성, 품질, 실시간성을 고려하여 우선순위를 설정하고 단계적으로 수집해 나갈 것을 권장한다.
