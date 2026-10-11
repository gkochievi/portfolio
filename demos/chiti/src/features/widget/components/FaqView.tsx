/** The pre-chat FAQ decision tree, rendered as bubbles with option chips. */
import { useEffect, useRef } from 'react'
import { ArrowLeft, Headset, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/format'
import type { FaqTree, Lang, LocalizedText } from '@/types'

import type { WidgetController, WidgetState } from '../controller'

function BotLine({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2 animate-hop">
      <BirdBadge size={22} className="shrink-0" />
      <p className="m-0 max-w-[84%] whitespace-pre-wrap rounded-bubble rounded-bl-[4px] border border-line bg-bot px-3 py-2 text-[14px] leading-[1.4] text-ink">{text}</p>
    </div>
  )
}

function UserLine({ text }: { text: string }) {
  return <p className="m-0 ml-auto max-w-[84%] rounded-bubble rounded-br-[4px] bg-primary px-3 py-2 text-[14px] leading-[1.4] text-on-primary animate-hop">{text}</p>
}

const chip =
  'rounded-full border-[1.5px] border-accent bg-panel px-3.5 py-1.5 text-left text-[13.5px] font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50'

export interface FaqViewProps {
  state: WidgetState
  controller: WidgetController
  tree: FaqTree
  lang: Lang
  showOperatorButton: boolean
}

export function FaqView({ state, controller, tree, lang, showOperatorButton }: FaqViewProps) {
  const { t } = useTranslation('widget')
  const scroller = useRef<HTMLDivElement>(null)
  const rootId = tree.rootIds[0]
  const nodeId = state.faqNodeId && tree.nodes[state.faqNodeId] ? state.faqNodeId : rootId
  const node = nodeId ? tree.nodes[nodeId] : undefined
  const isAnswer = node?.type === 'answer'
  const text = (value: LocalizedText) => pickText(value, lang)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [state.faqPath.length, nodeId])

  if (!node) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <BirdBadge size={34} />
        <p className="m-0 text-[14px] text-muted">{t('faq.empty')}</p>
        <button type="button" className={chip} onClick={() => controller.connectToOperator(tree, t('faq.connect'))}>
          {t('faq.connect')}
        </button>
      </div>
    )
  }

  const hasBack = state.faqStack.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-4" aria-live="polite">
        <p className="m-0 mb-1 text-center text-[12px] text-muted">{t('faq.hint')}</p>
        {state.faqPath.map((step, index) => (
          <div key={`${step.nodeId}-${index}`} className="flex flex-col gap-2.5">
            <BotLine text={step.question} />
            <UserLine text={step.answer} />
          </div>
        ))}
        <BotLine text={text(node.text)} />

        <div className="mt-1 flex flex-wrap gap-2 pl-[30px]" role="group" aria-label={t('faq.options')}>
          {node.options.map((option) => (
            <button key={option.id} type="button" className={chip} onClick={() => controller.chooseOption(tree, option)}>
              {text(option.label)}
            </button>
          ))}
          {isAnswer && showOperatorButton && (
            <button
              type="button"
              className={cn(chip, 'inline-flex items-center gap-1.5 border-ink bg-primary text-on-primary hover:bg-primary-hover')}
              onClick={() => controller.connectToOperator(tree, t('faq.connect'))}
            >
              <Headset size={15} strokeWidth={1.75} aria-hidden />
              {t('faq.connect')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-1.5">
        {hasBack ? (
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent" onClick={() => controller.faqBack()}>
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
            {t('faq.back')}
          </button>
        ) : (
          <span />
        )}
        {hasBack && (
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent" onClick={() => controller.resetFaq()}>
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
            {t('faq.startOver')}
          </button>
        )}
      </div>
    </div>
  )
}
