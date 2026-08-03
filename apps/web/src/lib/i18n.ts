import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import lv from '../locales/lv.json';
import ru from '../locales/ru.json';

/** LT and KA intentionally fall back to EN until translations land. */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    lv: { translation: lv },
    ru: { translation: ru },
  },
  lng: localStorage.getItem('nk_lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(code: string) {
  localStorage.setItem('nk_lang', code);
  void i18n.changeLanguage(code);
}

export default i18n;
