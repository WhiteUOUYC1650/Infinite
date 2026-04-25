'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/context/language-context';
import { Button } from './ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FaqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaqDialog({ open, onOpenChange }: FaqDialogProps) {
  const { t } = useLanguage();

  const faqs = [
    {
      question: t('faq_markdown_q'),
      answer: t('faq_markdown_a'),
    },
    {
      question: t('faq_create_chat_q'),
      answer: t('faq_create_chat_a'),
    },
    {
      question: t('faq_invite_q'),
      answer: t('faq_invite_a'),
    },
    {
      question: t('faq_edit_profile_q'),
      answer: t('faq_edit_profile_a'),
    },
    {
      question: t('faq_calls_q'),
      answer: t('faq_calls_a'),
    },
    {
      question: t('faq_media_q'),
      answer: t('faq_media_a'),
    },
    {
      question: t('faq_infgold_q'),
      answer: t('faq_infgold_a'),
    },
    {
      question: t('faq_prem_q'),
      answer: t('faq_prem_a'),
    },
    {
      question: t('faq_bot_q'),
      answer: t('faq_bot_a'),
    },
    {
      question: t('faq_security_q'),
      answer: t('faq_security_a'),
    },
    {
      question: t('faq_beta_badge_q'),
      answer: t('faq_beta_badge_a'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('faq_title')}</DialogTitle>
          <DialogDescription>{t('faq_desc')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 my-4 overflow-y-auto -mx-6 px-6">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem value={`item-${index}`} key={index}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                a: ({node, ...props}) => <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props} />
                            }}
                        >
                            {faq.answer}
                        </ReactMarkdown>
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('ok')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
