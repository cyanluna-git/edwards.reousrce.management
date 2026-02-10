import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LanguageToggleProps {
  variant?: 'default' | 'collapsed';
}

export function LanguageToggle({ variant = 'default' }: LanguageToggleProps) {
  const { i18n, t } = useTranslation('common');

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const currentLang = i18n.language || 'en';
  const currentLangLabel = currentLang === 'ko' ? '한국어' : 'English';

  if (variant === 'collapsed') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            title={t('language.switchLanguage')}
          >
            <Globe className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => changeLanguage('en')}
            className={currentLang === 'en' ? 'bg-slate-100 dark:bg-slate-800' : ''}
          >
            <span className="mr-2">🇺🇸</span>
            English
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => changeLanguage('ko')}
            className={currentLang === 'ko' ? 'bg-slate-100 dark:bg-slate-800' : ''}
          >
            <span className="mr-2">🇰🇷</span>
            한국어
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm">{currentLangLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className={currentLang === 'en' ? 'bg-slate-100 dark:bg-slate-800' : ''}
        >
          <span className="mr-2">🇺🇸</span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('ko')}
          className={currentLang === 'ko' ? 'bg-slate-100 dark:bg-slate-800' : ''}
        >
          <span className="mr-2">🇰🇷</span>
          한국어
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
