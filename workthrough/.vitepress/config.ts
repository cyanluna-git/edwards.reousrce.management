import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Edwards Resource Management - Workthrough',
  description: '개발 작업 기록',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' }
    ],
    sidebar: [
      {
        text: '개발 기록',
        items: [
          {
            text: '2026-01-31 프로젝트 인라인 편집 테이블',
            link: '/2026-01-31_17_00_project-inline-editing-table'
          },
          {
            text: '2026-01-30 DB 백업 스킬 & Env 통합',
            link: '/2026-01-30_22_45_db-backup-skill-and-env-consolidation'
          },
          {
            text: '2026-01-30 User Resolver 수동 매핑',
            link: '/2026-01-30_21_40_user-resolver-manual-mapping'
          },
          {
            text: '2026-01-30 CSV Worklog 마이그레이션 스킬',
            link: '/2026-01-30_20_30_csv-worklog-migration-skill'
          },
          {
            text: '2026-01-28 Vercel React Best Practices',
            link: '/2026-01-28_14_30_vercel-react-best-practices'
          },
          {
            text: '2026-01-28 Route-level Code Splitting',
            link: '/2026-01-28_11_00_route-level-code-splitting'
          },
          {
            text: '2026-01-28 TBD Assignment Modal',
            link: '/2026-01-28_10_15_tbd-assignment-modal'
          },
          {
            text: '2026-01-26 Phi3 Mini Performance Benchmark',
            link: '/2026-01-26_17_30_phi3-mini-performance-benchmark'
          },
          {
            text: '2026-01-26 AI Worklog Auto Input',
            link: '/2026-01-26_16_00_ai-worklog-auto-input'
          },
          {
            text: '2026-01-22 Manual Classification UI & Clean Architecture',
            link: '/2026-01-22_17_30_manual-classification-ui-and-clean-architecture-plan'
          },
          {
            text: '2026-01-21 Sustaining Matrix IO System',
            link: '/2026-01-21_19_30_sustaining-matrix-io-system'
          },
          {
            text: '2026-01-21 DB Schema Setup & Manual Classification',
            link: '/2026-01-21_18_05_db-schema-setup-and-manual-classification'
          },
          {
            text: '2026-01-21 Project Financial Backfill System',
            link: '/2026-01-21_14_30_project-financial-backfill-system'
          },
          {
            text: '2026-01-20 Resource Allocation Matrix',
            link: '/2026-01-20_23_19_resource-allocation-matrix'
          }
        ]
      }
    ],
    socialLinks: []
  }
})
