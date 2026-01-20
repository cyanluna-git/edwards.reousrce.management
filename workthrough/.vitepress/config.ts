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
            text: '2026-01-20 Resource Allocation Matrix',
            link: '/2026-01-20_23_19_resource-allocation-matrix'
          }
        ]
      }
    ],
    socialLinks: []
  }
})
