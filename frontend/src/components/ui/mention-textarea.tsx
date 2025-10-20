"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Badge } from './badge'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  availableColumns: string[]
  className?: string
  rows?: number
}

export function MentionTextarea({ 
  value, 
  onChange, 
  onKeyDown,
  placeholder = "Type @ to mention columns", 
  availableColumns,
  className,
  rows = 4
}: MentionTextareaProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const editorRef = useRef<HTMLDivElement>(null)

  // Convert value to HTML with inline badges
  const valueToHtml = useCallback((text: string) => {
    return text.replace(/@\[([^\]]+)\]/g, (match, columnName) => {
      return `<span class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-md border" contenteditable="false" data-mention="${columnName}">@${columnName}<button class="ml-1 hover:bg-destructive/20 rounded-full p-0.5" onclick="this.parentElement.remove(); this.dispatchEvent(new CustomEvent('mention-removed', { bubbles: true }))"><svg class="h-2 w-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button></span>`
    })
  }, [])

  // Convert HTML back to text value
  const htmlToValue = useCallback((html: string) => {
    // Replace badge spans with @[columnName] format
    return html
      .replace(/<span[^>]*data-mention="([^"]*)"[^>]*>.*?<\/span>/g, '@[$1]')
      .replace(/<[^>]*>/g, '') // Remove any other HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/<br\s*\/?>/gi, '\n') // Replace <br> tags with newlines
  }, [])

  // Update editor content when value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== valueToHtml(value)) {
      const currentSelection = window.getSelection()
      const range = currentSelection?.getRangeAt(0)
      const startOffset = range?.startOffset || 0
      
      editorRef.current.innerHTML = valueToHtml(value).replace(/\n/g, '<br>')
      
      // Restore cursor position
      if (currentSelection && range) {
        try {
          const newRange = document.createRange()
          const textNode = editorRef.current.childNodes[0]
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(textNode, Math.min(startOffset, textNode.textContent?.length || 0))
            newRange.collapse(true)
            currentSelection.removeAllRanges()
            currentSelection.addRange(newRange)
          }
        } catch (e) {
          // Ignore cursor positioning errors
        }
      }
    }
  }, [value, valueToHtml])

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const textContent = target.textContent || ''
    const htmlContent = target.innerHTML
    
    // Get cursor position
    const selection = window.getSelection()
    const range = selection?.getRangeAt(0)
    const cursorPos = range?.startOffset || 0

    // Check for @ mention trigger
    const lastAtIndex = textContent.lastIndexOf('@', cursorPos - 1)
    const textAfterAt = textContent.slice(lastAtIndex + 1, cursorPos)
    
    if (lastAtIndex !== -1 && !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
      // Check if we're not inside an existing mention badge
      const beforeAt = textContent.slice(0, lastAtIndex)
      const afterCursor = textContent.slice(cursorPos)
      const fullText = beforeAt + '@' + textAfterAt + afterCursor
      
      if (!fullText.includes('@[' + textAfterAt + ']')) {
        setMentionStart(lastAtIndex)
        setMentionQuery(textAfterAt)
        setIsOpen(true)
      }
    } else {
      setIsOpen(false)
      setMentionStart(-1)
      setMentionQuery('')
    }

    // Convert HTML back to text and update value
    const newValue = htmlToValue(htmlContent)
    onChange(newValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle dropdown navigation when open
    if (isOpen) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setMentionStart(-1)
        setMentionQuery('')
        e.preventDefault()
        return
      }
      // Let the Command component handle Enter, ArrowUp, ArrowDown
      if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Don't prevent default - let Command component handle it
        return
      }
    }
    
    // Call the external onKeyDown handler if provided
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  const handleMentionSelect = (column: string) => {
    if (mentionStart === -1 || !editorRef.current) return

    // Get the current value (which preserves existing mentions)
    const currentValue = htmlToValue(editorRef.current.innerHTML)
    
    // Find the position in the actual text value, not textContent
    const beforeMention = currentValue.slice(0, mentionStart)
    const afterAtSymbol = currentValue.slice(mentionStart + 1) // Skip the @ symbol
    
    // Find where the current mention query ends
    const queryEndIndex = afterAtSymbol.indexOf(' ')
    const lineEndIndex = afterAtSymbol.indexOf('\n')
    let endIndex = Math.min(
      queryEndIndex === -1 ? Infinity : queryEndIndex,
      lineEndIndex === -1 ? Infinity : lineEndIndex
    )
    
    if (endIndex === Infinity) {
      endIndex = mentionQuery.length
    }
    
    const afterMention = afterAtSymbol.slice(endIndex)
    const newValue = `${beforeMention}@[${column}]${afterMention}`
    
    onChange(newValue)
    
    setIsOpen(false)
    setMentionStart(-1)
    setMentionQuery('')

    // Focus back to editor and position cursor after the mention
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus()
        // Try to position cursor after the inserted mention
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }, 0)
  }

  const handleMentionRemoved = () => {
    // Update value when a mention badge is removed
    if (editorRef.current) {
      const newValue = htmlToValue(editorRef.current.innerHTML)
      onChange(newValue)
    }
  }

  const filteredColumns = availableColumns.filter(column =>
    column.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const minHeight = rows * 20 + 16 // Approximate line height + padding

  return (
    <Popover open={isOpen} onOpenChange={() => {}}>
      <PopoverTrigger asChild>
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => {
            // Prevent the popover from opening on click
            e.preventDefault()
          }}
          onClick={(e) => {
            // Prevent the popover from opening on click
            e.preventDefault()
            // Focus the editor instead
            if (editorRef.current) {
              editorRef.current.focus()
            }
          }}
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
            className
          )}
          data-placeholder={placeholder}
          suppressContentEditableWarning={true}
          style={{ 
            minHeight: `${minHeight}px`, 
            lineHeight: '20px',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word'
          }}
        />
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-[300px] p-0 max-h-[200px] overflow-auto"
        align="start"
        side="bottom"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={10}
      >
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {filteredColumns.map((column) => (
                <CommandItem
                  key={column}
                  onSelect={() => handleMentionSelect(column)}
                  className="cursor-pointer"
                >
                  <span className="text-muted-foreground mr-2">@</span>
                  {column}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}