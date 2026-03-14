import {
  sanitizeHtml,
  sanitizePlainText,
  stripHtml,
  containsDangerousContent,
  sanitizeUrl,
  ALLOWED_TAGS,
  ALLOWED_ATTRIBUTES,
} from '@/lib/utils/html-sanitize'

describe('html-sanitize', () => {
  describe('ALLOWED_TAGS', () => {
    it('should not contain dangerous tags', () => {
      const dangerousTags = [
        'script',
        'iframe',
        'object',
        'embed',
        'applet',
        'meta',
        'link',
        'base',
        'form',
      ]
      for (const tag of dangerousTags) {
        expect(ALLOWED_TAGS).not.toContain(tag)
      }
    })

    it('should contain safe tags', () => {
      const safeTags = ['p', 'div', 'span', 'a', 'strong', 'em', 'ul', 'ol', 'li']
      for (const tag of safeTags) {
        expect(ALLOWED_TAGS).toContain(tag)
      }
    })
  })

  describe('ALLOWED_ATTRIBUTES', () => {
    it('should allow class and id on all elements', () => {
      expect(ALLOWED_ATTRIBUTES['*']).toContain('class')
      expect(ALLOWED_ATTRIBUTES['*']).toContain('id')
    })

    it('should allow href on anchor tags', () => {
      expect(ALLOWED_ATTRIBUTES['a']).toContain('href')
    })

    it('should allow src and alt on img tags', () => {
      expect(ALLOWED_ATTRIBUTES['img']).toContain('src')
      expect(ALLOWED_ATTRIBUTES['img']).toContain('alt')
    })
  })

  describe('sanitizeHtml', () => {
    it('should return empty string for non-string input', () => {
      expect(sanitizeHtml(null as unknown as string)).toBe('')
      expect(sanitizeHtml(undefined as unknown as string)).toBe('')
      expect(sanitizeHtml(123 as unknown as string)).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(sanitizeHtml('')).toBe('')
    })

    it('should preserve safe HTML', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      expect(sanitizeHtml(input)).toBe('<p>Hello <strong>World</strong></p>')
    })

    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("XSS")</script>'
      expect(sanitizeHtml(input)).toBe('<p>Hello</p>')
    })

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe><p>Safe</p>'
      expect(sanitizeHtml(input)).toBe('<p>Safe</p>')
    })

    it('should remove object and embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf"><p>Safe</p>'
      expect(sanitizeHtml(input)).toBe('<p>Safe</p>')
    })

    it('should remove onclick event handlers', () => {
      const input = '<p onclick="alert(\'XSS\')">Click me</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onclick')
      expect(result).toContain('Click me')
    })

    it('should remove onerror event handlers', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onerror')
    })

    it('should remove onmouseover event handlers', () => {
      const input = '<div onmouseover="alert(\'XSS\')">Hover me</div>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onmouseover')
    })

    it('should remove javascript: protocol in href', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('javascript:')
    })

    it('should preserve safe links', () => {
      const input = '<a href="https://example.com">Link</a>'
      expect(sanitizeHtml(input)).toBe('<a href="https://example.com">Link</a>')
    })

    it('should allow custom allowed tags', () => {
      const input = '<custom>Hello</custom><p>World</p>'
      const result = sanitizeHtml(input, { allowedTags: ['custom', 'p'] })
      expect(result).toContain('<custom>Hello</custom>')
      expect(result).toContain('<p>World</p>')
    })

    it('should allow data attributes when configured', () => {
      const input = '<div data-id="123">Content</div>'
      const result = sanitizeHtml(input, { allowDataAttributes: true })
      expect(result).toContain('data-id')
    })

    it('should remove data attributes by default', () => {
      const input = '<div data-id="123">Content</div>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('data-id')
    })

    it('should handle nested dangerous content', () => {
      const input = '<div><script>alert(1)</script><p>Safe<script>alert(2)</script></p></div>'
      expect(sanitizeHtml(input)).toBe('<div><p>Safe</p></div>')
    })

    it('should preserve valid img tags with safe attributes', () => {
      const input = '<img src="image.png" alt="test" width="100" height="100">'
      const result = sanitizeHtml(input)
      expect(result).toContain('src="image.png"')
      expect(result).toContain('alt="test"')
    })

    it('should handle malformed HTML gracefully', () => {
      const input = '<p>Unclosed paragraph<div>Nested</p></div>'
      const result = sanitizeHtml(input)
      expect(result).toContain('Unclosed paragraph')
      expect(result).toContain('Nested')
    })
  })

  describe('sanitizePlainText', () => {
    it('should return empty string for non-string input', () => {
      expect(sanitizePlainText(null as unknown as string)).toBe('')
      expect(sanitizePlainText(undefined as unknown as string)).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(sanitizePlainText('')).toBe('')
    })

    it('should escape less-than sign', () => {
      expect(sanitizePlainText('<')).toBe('&lt;')
    })

    it('should escape greater-than sign', () => {
      expect(sanitizePlainText('>')).toBe('&gt;')
    })

    it('should escape ampersand', () => {
      expect(sanitizePlainText('&')).toBe('&amp;')
    })

    it('should escape double quotes', () => {
      expect(sanitizePlainText('"')).toBe('&quot;')
    })

    it('should escape single quotes', () => {
      expect(sanitizePlainText("'")).toBe('&#x27;')
    })

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1FTest\x7F'
      expect(sanitizePlainText(input)).toBe('HelloWorldTest')
    })

    it('should preserve normal text', () => {
      expect(sanitizePlainText('Hello World')).toBe('Hello World')
    })

    it('should escape multiple special characters', () => {
      const input = '<script>alert("XSS")</script>'
      const result = sanitizePlainText(input)
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
    })

    it('should preserve unicode characters', () => {
      expect(sanitizePlainText('日本語')).toBe('日本語')
      expect(sanitizePlainText('émoji 🎉')).toBe('émoji 🎉')
    })
  })

  describe('stripHtml', () => {
    it('should return empty string for non-string input', () => {
      expect(stripHtml(null as unknown as string)).toBe('')
      expect(stripHtml(undefined as unknown as string)).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(stripHtml('')).toBe('')
    })

    it('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      expect(stripHtml(input)).toBe('Hello World')
    })

    it('should remove nested tags', () => {
      const input = '<div><p><span>Nested</span> Content</p></div>'
      expect(stripHtml(input)).toBe('Nested Content')
    })

    it('should remove script content', () => {
      const input = '<p>Safe</p><script>alert("XSS")</script>'
      expect(stripHtml(input)).toBe('Safe')
    })

    it('should remove attributes', () => {
      const input = '<a href="https://example.com" class="link">Link</a>'
      expect(stripHtml(input)).toBe('Link')
    })

    it('should handle self-closing tags', () => {
      const input = 'Line 1<br/>Line 2<img src="x" alt="y"/>'
      const result = stripHtml(input)
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 2')
      expect(result).not.toContain('<')
    })

    it('should collapse multiple whitespace', () => {
      const input = '<p>Hello</p>   <p>World</p>'
      expect(stripHtml(input)).toBe('Hello World')
    })

    it('should preserve plain text', () => {
      expect(stripHtml('Just plain text')).toBe('Just plain text')
    })

    it('should handle complex HTML', () => {
      const input = `
        <html>
          <head><title>Title</title></head>
          <body>
            <h1>Header</h1>
            <p>Paragraph with <a href="#">link</a></p>
          </body>
        </html>
      `
      const result = stripHtml(input)
      expect(result).not.toContain('<')
      expect(result).toContain('Header')
      expect(result).toContain('Paragraph')
    })
  })

  describe('containsDangerousContent', () => {
    it('should return false for non-string input', () => {
      expect(containsDangerousContent(null as unknown as string)).toBe(false)
      expect(containsDangerousContent(undefined as unknown as string)).toBe(false)
    })

    it('should return false for empty input', () => {
      expect(containsDangerousContent('')).toBe(false)
    })

    it('should return false for safe content', () => {
      expect(containsDangerousContent('<p>Hello World</p>')).toBe(false)
    })

    it('should detect script tags', () => {
      expect(containsDangerousContent('<script>alert(1)</script>')).toBe(true)
    })

    it('should detect iframe tags', () => {
      expect(containsDangerousContent('<iframe src="x">')).toBe(true)
    })

    it('should detect object tags', () => {
      expect(containsDangerousContent('<object data="x">')).toBe(true)
    })

    it('should detect embed tags', () => {
      expect(containsDangerousContent('<embed src="x">')).toBe(true)
    })

    it('should detect onclick handlers', () => {
      expect(containsDangerousContent('<div onclick="alert(1)">')).toBe(true)
    })

    it('should detect onerror handlers', () => {
      expect(containsDangerousContent('<img onerror="alert(1)">')).toBe(true)
    })

    it('should detect javascript: protocol', () => {
      expect(containsDangerousContent('<a href="javascript:alert(1)">')).toBe(true)
    })

    it('should detect vbscript: protocol', () => {
      expect(containsDangerousContent('<a href="vbscript:alert(1)">')).toBe(true)
    })

    it('should detect data: text/html protocol', () => {
      expect(containsDangerousContent('<a href="data:text/html,<script>">')).toBe(true)
    })

    it('should not false positive on normal content', () => {
      expect(containsDangerousContent('Click on the button below')).toBe(false)
      expect(containsDangerousContent('Object-oriented programming')).toBe(false)
      expect(containsDangerousContent('The script was great')).toBe(false)
    })
  })

  describe('sanitizeUrl', () => {
    it('should return empty string for non-string input', () => {
      expect(sanitizeUrl(null as unknown as string)).toBe('')
      expect(sanitizeUrl(undefined as unknown as string)).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(sanitizeUrl('')).toBe('')
    })

    it('should allow http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
    })

    it('should allow https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    })

    it('should allow mailto URLs', () => {
      expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com')
    })

    it('should allow tel URLs', () => {
      expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890')
    })

    it('should allow ftp URLs', () => {
      expect(sanitizeUrl('ftp://example.com')).toBe('ftp://example.com')
    })

    it('should allow relative URLs', () => {
      expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page')
      expect(sanitizeUrl('./relative')).toBe('./relative')
    })

    it('should remove javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    })

    it('should remove vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:alert(1)')).toBe('')
    })

    it('should remove javascript: with spaces', () => {
      expect(sanitizeUrl('  javascript:alert(1)  ')).toBe('')
    })

    it('should handle case-insensitive protocol check', () => {
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('')
      expect(sanitizeUrl('JavaScript:alert(1)')).toBe('')
    })

    it('should trim whitespace', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
    })

    it('should block unknown protocols', () => {
      expect(sanitizeUrl('data:text/html,<script>')).toBe('')
    })
  })

  describe('XSS prevention edge cases', () => {
    it('should handle encoded script tags', () => {
      const input = '&lt;script&gt;alert(1)&lt;/script&gt;'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<script>')
    })

    it('should handle mixed case tags', () => {
      const input = '<ScRiPt>alert(1)</sCrIpT>'
      const result = sanitizeHtml(input)
      expect(result.toLowerCase()).not.toContain('<script>')
    })

    it('should handle tags with spaces', () => {
      const input = '<script >alert(1)</script >'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('alert')
    })

    it('should handle SVG-based XSS', () => {
      const input = '<svg onload="alert(1)">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onload')
    })

    it('should handle event handlers with spaces', () => {
      const input = '<img src="x" onerror = "alert(1)">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onerror')
    })

    it('should handle newlines in event handlers', () => {
      const input = '<div onclick\n="alert(1)">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onclick')
    })
  })
})
