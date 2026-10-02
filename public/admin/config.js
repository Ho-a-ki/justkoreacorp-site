// 유스트코리아 관리자(Sveltia CMS) 설정.
// 필드를 바꾸면 src/content.config.ts 의 스키마도 같이 맞춘다.
// 운영자가 고칠 수 있는 파일 범위는 src/lib/cms/cms.mjs 의 ALLOWED_PATHS 와 함께 맞춘다.

const origin = window.location.origin;

const draft = {
  name: 'draft',
  label: '숨기기',
  hint: '켜 두면 저장은 되지만 사이트에는 보이지 않습니다.',
  widget: 'boolean',
  default: false,
  required: false,
};
const date = { name: 'date', label: '날짜', widget: 'datetime', format: 'YYYY-MM-DD', time_format: false };
const tags = {
  name: 'tags',
  label: '태그',
  hint: '쉼표(,)로 여러 개를 적을 수 있습니다.',
  widget: 'list',
  required: false,
};
const thumbnail = {
  name: 'thumbnail',
  label: '대표 이미지',
  hint: '목록 카드에 보입니다. 비워 두면 본문의 첫 이미지를 씁니다.',
  widget: 'image',
  required: false,
};
const body = { name: 'body', label: '본문', widget: 'markdown', required: false };
// 새 글 파일 이름: 날짜-시각 (한글 제목이 주소에 들어가지 않게)
const slug = '{{year}}{{month}}{{day}}-{{hour}}{{minute}}';

const FAQ_CATEGORIES = ['제품 사용', '제품 관련', '제품 사용 후 증상', '성분', '유스트와 환경', '기타', '사이트 이용관련'];
const ACTIVITY_CATEGORIES = ['수상', '교육/강연', '행사/활동', '방문/미팅', '기부/봉사', '기타'];

window.CMS.init({
  config: {
    load_config_file: false,
    backend: {
      name: 'github',
      repo: 'Ho-a-ki/justkoreacorp-site',
      branch: 'main',
      base_url: origin,
      auth_endpoint: 'api/cms-auth',
      api_root: `${origin}/api/gh`,
      commit_messages: {
        create: '내용: {{collection}} "{{slug}}" 추가 (관리자 페이지)',
        update: '내용: {{collection}} "{{slug}}" 수정 (관리자 페이지)',
        delete: '내용: {{collection}} "{{slug}}" 삭제 (관리자 페이지)',
        uploadMedia: '내용: 파일 "{{path}}" 올림 (관리자 페이지)',
        deleteMedia: '내용: 파일 "{{path}}" 삭제 (관리자 페이지)',
      },
    },
    site_url: origin,
    display_url: origin,
    logo_url: '/favicon.svg',
    media_folder: 'public/images/uploads',
    public_folder: '/images/uploads',
    media_libraries: {
      default: {
        config: {
          // 올린 사진은 webp 로 바꾸고 2000px 안으로 줄인다 (중계 서버가 큰 파일을 못 받는다)
          max_file_size: 4_000_000,
          slugify_filename: true,
          transformations: {
            raster_image: { format: 'webp', quality: 85, width: 2000, height: 2000 },
          },
        },
      },
    },
    collections: [
      {
        name: 'activities',
        label: '주요 활동',
        label_singular: '활동',
        folder: 'src/content/activities',
        create: true,
        slug,
        identifier_field: 'title',
        sortable_fields: ['date', 'title'],
        summary: '{{date}} · {{title}}',
        fields: [
          { name: 'title', label: '제목', widget: 'string' },
          date,
          { name: 'category', label: '구분', widget: 'select', options: ACTIVITY_CATEGORIES, default: '기타' },
          { name: 'summary', label: '한 줄 요약', hint: '목록과 상단에 보이는 짧은 설명입니다.', widget: 'text', required: false },
          draft,
          body,
        ],
      },
      {
        name: 'press',
        label: '미디어 · Press',
        label_singular: '기사',
        folder: 'src/content/press',
        create: true,
        slug,
        identifier_field: 'name',
        sortable_fields: ['date', 'name'],
        summary: '{{date}} · {{name}}',
        fields: [{ name: 'name', label: '제목', hint: '예: 보그_31허브 오일', widget: 'string' }, date, thumbnail, tags, draft, body],
      },
      {
        name: 'celeb',
        label: '미디어 · 셀럽',
        label_singular: '셀럽',
        folder: 'src/content/celeb',
        create: true,
        slug,
        identifier_field: 'name',
        sortable_fields: ['date', 'name'],
        summary: '{{date}} · {{name}}',
        fields: [
          { name: 'name', label: '이름 · 제품', hint: '예: 정은채-알프스허브밤', widget: 'string' },
          date,
          {
            name: 'url',
            label: '바로 가는 링크',
            hint: '유튜브·인스타그램 주소를 적으면 카드를 눌렀을 때 그 주소로 바로 갑니다.',
            widget: 'string',
            required: false,
          },
          thumbnail,
          tags,
          draft,
          body,
        ],
      },
      {
        name: 'herbs',
        label: '허브 백과사전',
        label_singular: '허브',
        folder: 'src/content/herbs',
        create: true,
        slug,
        identifier_field: 'name',
        sortable_fields: ['name'],
        summary: '{{name}}',
        fields: [{ name: 'name', label: '허브 이름', widget: 'string' }, thumbnail, tags, draft, body],
      },
      {
        name: 'faq',
        label: '자주 묻는 질문',
        label_singular: '질문',
        folder: 'src/content/faq',
        create: true,
        slug,
        identifier_field: 'question',
        sortable_fields: ['category', 'order', 'question'],
        summary: '[{{category}}] {{question}}',
        view_groups: [{ label: '분류', field: 'category' }],
        fields: [
          { name: 'question', label: '질문', widget: 'string' },
          { name: 'category', label: '분류', widget: 'select', options: FAQ_CATEGORIES, default: FAQ_CATEGORIES[0] },
          {
            name: 'order',
            label: '순서',
            hint: '같은 분류 안에서 작은 숫자가 위에 보입니다. 10, 20, 30 처럼 띄워 두면 사이에 끼워 넣기 쉽습니다.',
            widget: 'number',
            value_type: 'int',
            default: 100,
          },
          draft,
          { name: 'body', label: '답변', hint: '인용(") 블록은 강조 상자로 보입니다.', widget: 'markdown' },
        ],
      },
      {
        name: 'data',
        label: '사이트 정보',
        files: [
          {
            name: 'stores',
            label: '스토어',
            file: 'src/data/stores.json',
            fields: [
              {
                name: 'stores',
                label: '매장',
                label_singular: '매장',
                hint: '이 순서대로 사이트에 보입니다. 끌어서 순서를 바꿀 수 있습니다.',
                widget: 'list',
                summary: '[{{tag}}] {{name}}',
                fields: [
                  { name: 'name', label: '매장명', widget: 'string' },
                  {
                    name: 'tag',
                    label: '구분',
                    widget: 'select',
                    options: ['직영', '현대', '롯데', '신세계', '기타'],
                    required: false,
                  },
                  { name: 'address', label: '주소', widget: 'string', required: false },
                  { name: 'phone', label: '전화', widget: 'string', required: false },
                  { name: 'spa', label: '스파 가능', widget: 'boolean', default: false, required: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});
