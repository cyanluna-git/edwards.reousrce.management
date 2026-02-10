import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// --- EN namespaces ---
import enCommon from '../../public/locales/en/common.json';
import enNavigation from '../../public/locales/en/navigation.json';
import enAuth from '../../public/locales/en/auth.json';
import enDashboard from '../../public/locales/en/dashboard.json';
import enWorklogs from '../../public/locales/en/worklogs.json';
import enProjects from '../../public/locales/en/projects.json';
import enResourcePlans from '../../public/locales/en/resource-plans.json';
import enOrganization from '../../public/locales/en/organization.json';
import enReports from '../../public/locales/en/reports.json';
import enErrors from '../../public/locales/en/errors.json';
import enValidation from '../../public/locales/en/validation.json';

// --- KO namespaces ---
import koCommon from '../../public/locales/ko/common.json';
import koNavigation from '../../public/locales/ko/navigation.json';
import koAuth from '../../public/locales/ko/auth.json';
import koDashboard from '../../public/locales/ko/dashboard.json';
import koWorklogs from '../../public/locales/ko/worklogs.json';
import koProjects from '../../public/locales/ko/projects.json';
import koResourcePlans from '../../public/locales/ko/resource-plans.json';
import koOrganization from '../../public/locales/ko/organization.json';
import koReports from '../../public/locales/ko/reports.json';
import koErrors from '../../public/locales/ko/errors.json';
import koValidation from '../../public/locales/ko/validation.json';

export const supportedLanguages = ['en', 'ko'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        navigation: enNavigation,
        auth: enAuth,
        dashboard: enDashboard,
        worklogs: enWorklogs,
        projects: enProjects,
        'resource-plans': enResourcePlans,
        organization: enOrganization,
        reports: enReports,
        errors: enErrors,
        validation: enValidation,
      },
      ko: {
        common: koCommon,
        navigation: koNavigation,
        auth: koAuth,
        dashboard: koDashboard,
        worklogs: koWorklogs,
        projects: koProjects,
        'resource-plans': koResourcePlans,
        organization: koOrganization,
        reports: koReports,
        errors: koErrors,
        validation: koValidation,
      },
    },
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    defaultNS: 'common',
    ns: [
      'common',
      'navigation',
      'auth',
      'dashboard',
      'worklogs',
      'projects',
      'resource-plans',
      'organization',
      'reports',
      'errors',
      'validation',
    ],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
