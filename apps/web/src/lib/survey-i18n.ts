/**
 * Lightweight survey translation utility.
 * Used in client components where next-intl hooks aren't available
 * (survey runner is outside the [locale] route segment).
 */

import type { Locale } from '@/i18n/routing'

type Messages = {
  start: string
  next: string
  back: string
  submit: string
  cancel: string
  skip: string
  submitting: string
  question_of: (current: number, total: number) => string
  required: string
  thank_you: string
  open_text_placeholder: string
  nps_not_likely: string
  nps_very_likely: string
}

const TRANSLATIONS: Record<Locale, Messages> = {
  en: {
    start:                'Start survey',
    next:                 'Next',
    back:                 'Back',
    submit:               'Submit',
    cancel:               'Cancel',
    skip:                 'Skip this question',
    submitting:           'Submitting…',
    question_of:          (c, t) => `Question ${c} of ${t}`,
    required:             'This question is required',
    thank_you:            'Thank you for your feedback!',
    open_text_placeholder:'Type your response here…',
    nps_not_likely:       'Not at all likely',
    nps_very_likely:      'Extremely likely',
  },
  es: {
    start:                'Comenzar encuesta',
    next:                 'Siguiente',
    back:                 'Atrás',
    submit:               'Enviar',
    cancel:               'Cancelar',
    skip:                 'Omitir esta pregunta',
    submitting:           'Enviando…',
    question_of:          (c, t) => `Pregunta ${c} de ${t}`,
    required:             'Esta pregunta es obligatoria',
    thank_you:            '¡Gracias por tu opinión!',
    open_text_placeholder:'Escribe tu respuesta aquí…',
    nps_not_likely:       'Muy improbable',
    nps_very_likely:      'Muy probable',
  },
  ar: {
    start:                'ابدأ الاستطلاع',
    next:                 'التالي',
    back:                 'رجوع',
    submit:               'إرسال',
    cancel:               'إلغاء',
    skip:                 'تخطَّ هذا السؤال',
    submitting:           '…جارٍ الإرسال',
    question_of:          (c, t) => `السؤال ${c} من ${t}`,
    required:             'هذا السؤال مطلوب',
    thank_you:            '!شكراً على ملاحظاتك',
    open_text_placeholder:'اكتب ردك هنا…',
    nps_not_likely:       'غير محتمل على الإطلاق',
    nps_very_likely:      'محتمل جداً',
  },
}

export function getSurveyT(locale: string): Messages {
  return TRANSLATIONS[(locale as Locale) in TRANSLATIONS ? (locale as Locale) : 'en']
}

export function isRtl(locale: string): boolean {
  return locale === 'ar'
}
