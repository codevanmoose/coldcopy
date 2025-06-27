import {
  SESClient,
  SendEmailCommand,
  SendBulkTemplatedEmailCommand,
  SendRawEmailCommand,
  VerifyEmailIdentityCommand,
} from '@aws-sdk/client-ses'
import { sendEmail, sendBulkEmails, verifyEmailAddress } from '../ses-client'

// Mock AWS SDK
jest.mock('@aws-sdk/client-ses')

describe('SES Email Service', () => {
  let mockSESClient: jest.Mocked<SESClient>
  let mockSend: jest.Mock

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock SES client
    mockSend = jest.fn()
    mockSESClient = {
      send: mockSend,
    } as any

    // Mock constructor
    ;(SESClient as jest.Mock).mockImplementation(() => mockSESClient)

    // Set environment variables
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key'
    process.env.SES_CONFIGURATION_SET = 'test-config-set'
  })

  describe('sendEmail', () => {
    describe('simple email format', () => {
      it('should send a simple email successfully', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender Name' },
          to: ['recipient@example.com'],
          subject: 'Test Email',
          html: '<p>Test HTML content</p>',
          text: 'Test text content',
          tags: { campaign: 'test-campaign', type: 'transactional' },
        }

        // Act
        const result = await sendEmail(emailOptions)

        // Assert
        expect(result).toEqual({
          success: true,
          messageId: 'msg-123',
        })

        expect(mockSend).toHaveBeenCalledWith(
          expect.any(SendEmailCommand)
        )

        const command = mockSend.mock.calls[0][0]
        expect(command.input).toEqual({
          Source: 'Sender Name <sender@example.com>',
          Destination: {
            ToAddresses: ['recipient@example.com'],
          },
          ReplyToAddresses: undefined,
          Message: {
            Subject: {
              Data: 'Test Email',
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: '<p>Test HTML content</p>',
                Charset: 'UTF-8',
              },
              Text: {
                Data: 'Test text content',
                Charset: 'UTF-8',
              },
            },
          },
          ConfigurationSetName: 'test-config-set',
          Tags: [
            { Name: 'campaign', Value: 'test-campaign' },
            { Name: 'type', Value: 'transactional' },
          ],
        })
      })

      it('should handle reply-to address', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          replyTo: 'reply@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        await sendEmail(emailOptions)

        // Assert
        const command = mockSend.mock.calls[0][0]
        expect(command.input.ReplyToAddresses).toEqual(['reply@example.com'])
      })

      it('should handle multiple recipients', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient1@example.com', 'recipient2@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        await sendEmail(emailOptions)

        // Assert
        const command = mockSend.mock.calls[0][0]
        expect(command.input.Destination.ToAddresses).toEqual([
          'recipient1@example.com',
          'recipient2@example.com',
        ])
      })
    })

    describe('raw email format with custom headers', () => {
      it('should send raw email with custom headers', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          subject: 'Test Email',
          html: '<p>Test HTML</p>',
          text: 'Test text',
          headers: {
            'X-Campaign-ID': 'campaign-123',
            'X-Lead-ID': 'lead-456',
            'List-Unsubscribe': '<https://example.com/unsubscribe>',
          },
        }

        // Act
        const result = await sendEmail(emailOptions)

        // Assert
        expect(result).toEqual({
          success: true,
          messageId: 'msg-123',
        })

        expect(mockSend).toHaveBeenCalledWith(
          expect.any(SendRawEmailCommand)
        )

        const command = mockSend.mock.calls[0][0]
        expect(command.input.Source).toBe('Sender <sender@example.com>')
        expect(command.input.Destinations).toEqual(['recipient@example.com'])

        // Check raw email content
        const rawEmail = command.input.RawMessage.Data.toString()
        expect(rawEmail).toContain('From: Sender <sender@example.com>')
        expect(rawEmail).toContain('To: recipient@example.com')
        expect(rawEmail).toContain('Subject: Test Email')
        expect(rawEmail).toContain('X-Campaign-ID: campaign-123')
        expect(rawEmail).toContain('X-Lead-ID: lead-456')
        expect(rawEmail).toContain('List-Unsubscribe: <https://example.com/unsubscribe>')
        expect(rawEmail).toContain('Test text')
        expect(rawEmail).toContain('<p>Test HTML</p>')
      })

      it('should include reply-to in raw email', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          replyTo: 'reply@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
          headers: { 'X-Custom': 'value' },
        }

        // Act
        await sendEmail(emailOptions)

        // Assert
        const command = mockSend.mock.calls[0][0]
        const rawEmail = command.input.RawMessage.Data.toString()
        expect(rawEmail).toContain('Reply-To: reply@example.com')
      })
    })

    describe('error handling', () => {
      it('should handle SES errors gracefully', async () => {
        // Arrange
        const sesError = new Error('MessageRejected: Email address is not verified')
        mockSend.mockRejectedValue(sesError)

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['invalid@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        const result = await sendEmail(emailOptions)

        // Assert
        expect(result).toEqual({
          success: false,
          error: 'MessageRejected: Email address is not verified',
        })
      })

      it('should handle unknown errors', async () => {
        // Arrange
        mockSend.mockRejectedValue('Unknown error')

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        const result = await sendEmail(emailOptions)

        // Assert
        expect(result).toEqual({
          success: false,
          error: 'Unknown error',
        })
      })

      it('should log errors to console', async () => {
        // Arrange
        const error = new Error('SES error')
        mockSend.mockRejectedValue(error)
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        await sendEmail(emailOptions)

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith('SES send error:', error)
        consoleSpy.mockRestore()
      })
    })

    describe('edge cases', () => {
      it('should handle email options without tags', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender' },
          to: ['recipient@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }

        // Act
        await sendEmail(emailOptions)

        // Assert
        const command = mockSend.mock.calls[0][0]
        expect(command.input.Tags).toBeUndefined()
      })

      it('should handle special characters in email content', async () => {
        // Arrange
        mockSend.mockResolvedValue({ MessageId: 'msg-123' })

        const emailOptions = {
          from: { email: 'sender@example.com', name: 'Sender™' },
          to: ['recipient@example.com'],
          subject: 'Test Subject with émojis 🎉',
          html: '<p>Test with special chars: &lt;&gt;&amp;</p>',
          text: 'Test with special chars: <>&',
        }

        // Act
        const result = await sendEmail(emailOptions)

        // Assert
        expect(result.success).toBe(true)
        const command = mockSend.mock.calls[0][0]
        expect(command.input.Message.Subject.Data).toBe('Test Subject with émojis 🎉')
      })
    })
  })

  describe('sendBulkEmails', () => {
    it('should send bulk emails successfully', async () => {
      // Arrange
      mockSend.mockResolvedValue({
        Status: [
          { MessageId: 'msg-1' },
          { MessageId: 'msg-2' },
          { MessageId: 'msg-3' },
        ],
      })

      const bulkOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        template: 'campaign-template',
        defaultTemplateData: {
          companyName: 'Example Corp',
          unsubscribeUrl: 'https://example.com/unsubscribe',
        },
        destinations: [
          {
            email: 'user1@example.com',
            templateData: { firstName: 'John', lastName: 'Doe' },
            tags: { leadId: 'lead-1' },
          },
          {
            email: 'user2@example.com',
            templateData: { firstName: 'Jane', lastName: 'Smith' },
            tags: { leadId: 'lead-2' },
          },
          {
            email: 'user3@example.com',
          },
        ],
        replyTo: 'reply@example.com',
      }

      // Act
      const result = await sendBulkEmails(bulkOptions)

      // Assert
      expect(result).toEqual({
        success: true,
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(SendBulkTemplatedEmailCommand)
      )

      const command = mockSend.mock.calls[0][0]
      expect(command.input).toEqual({
        Source: 'Sender <sender@example.com>',
        Template: 'campaign-template',
        DefaultTemplateData: JSON.stringify({
          companyName: 'Example Corp',
          unsubscribeUrl: 'https://example.com/unsubscribe',
        }),
        Destinations: [
          {
            Destination: { ToAddresses: ['user1@example.com'] },
            ReplacementTemplateData: JSON.stringify({
              firstName: 'John',
              lastName: 'Doe',
            }),
            ReplacementTags: [{ Name: 'leadId', Value: 'lead-1' }],
          },
          {
            Destination: { ToAddresses: ['user2@example.com'] },
            ReplacementTemplateData: JSON.stringify({
              firstName: 'Jane',
              lastName: 'Smith',
            }),
            ReplacementTags: [{ Name: 'leadId', Value: 'lead-2' }],
          },
          {
            Destination: { ToAddresses: ['user3@example.com'] },
            ReplacementTemplateData: undefined,
            ReplacementTags: undefined,
          },
        ],
        ReplyToAddresses: ['reply@example.com'],
        ConfigurationSetName: 'test-config-set',
      })
    })

    it('should handle custom configuration set', async () => {
      // Arrange
      mockSend.mockResolvedValue({ Status: [] })

      const bulkOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        template: 'template',
        defaultTemplateData: {},
        destinations: [{ email: 'user@example.com' }],
        configurationSet: 'custom-config-set',
      }

      // Act
      await sendBulkEmails(bulkOptions)

      // Assert
      const command = mockSend.mock.calls[0][0]
      expect(command.input.ConfigurationSetName).toBe('custom-config-set')
    })

    it('should handle bulk email errors', async () => {
      // Arrange
      const error = new Error('Template not found')
      mockSend.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const bulkOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        template: 'invalid-template',
        defaultTemplateData: {},
        destinations: [{ email: 'user@example.com' }],
      }

      // Act
      const result = await sendBulkEmails(bulkOptions)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Template not found',
      })
      expect(consoleSpy).toHaveBeenCalledWith('SES bulk send error:', error)
      consoleSpy.mockRestore()
    })

    it('should handle empty destinations', async () => {
      // Arrange
      mockSend.mockResolvedValue({ Status: [] })

      const bulkOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        template: 'template',
        defaultTemplateData: {},
        destinations: [],
      }

      // Act
      const result = await sendBulkEmails(bulkOptions)

      // Assert
      expect(result).toEqual({
        success: true,
        messageIds: [],
      })
    })
  })

  describe('verifyEmailAddress', () => {
    it('should verify email address successfully', async () => {
      // Arrange
      mockSend.mockResolvedValue({})

      // Act
      const result = await verifyEmailAddress('test@example.com')

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(VerifyEmailIdentityCommand)
      )

      const command = mockSend.mock.calls[0][0]
      expect(command.input).toEqual({
        EmailAddress: 'test@example.com',
      })
    })

    it('should handle verification errors', async () => {
      // Arrange
      const error = new Error('Email already verified')
      mockSend.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act
      const result = await verifyEmailAddress('test@example.com')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Email already verified',
      })
      expect(consoleSpy).toHaveBeenCalledWith('SES verify error:', error)
      consoleSpy.mockRestore()
    })
  })

  describe('AWS SES Client Configuration', () => {
    it('should initialize SES client with correct configuration', () => {
      // Assert
      expect(SESClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      })
    })

    it('should use default region if not specified', () => {
      // Arrange
      delete process.env.AWS_REGION
      jest.resetModules()

      // Act
      require('../ses-client')

      // Assert
      expect(SESClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate limit errors', async () => {
      // Arrange
      const rateLimitError = new Error('Sending rate exceeded')
      ;(rateLimitError as any).code = 'SendingRateExceeded'
      mockSend.mockRejectedValue(rateLimitError)

      const emailOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      }

      // Act
      const result = await sendEmail(emailOptions)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Sending rate exceeded',
      })
    })
  })

  describe('Bounce and Complaint Handling', () => {
    it('should include configuration set for tracking', async () => {
      // Arrange
      mockSend.mockResolvedValue({ MessageId: 'msg-123' })

      const emailOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      }

      // Act
      await sendEmail(emailOptions)

      // Assert
      const command = mockSend.mock.calls[0][0]
      expect(command.input.ConfigurationSetName).toBe('test-config-set')
    })
  })

  describe('Template Rendering', () => {
    it('should send bulk emails with template data', async () => {
      // Arrange
      mockSend.mockResolvedValue({ Status: [{ MessageId: 'msg-1' }] })

      const bulkOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        template: 'welcome-email',
        defaultTemplateData: {
          companyName: 'ColdCopy',
          supportEmail: 'support@coldcopy.com',
        },
        destinations: [
          {
            email: 'user@example.com',
            templateData: {
              firstName: 'John',
              activationLink: 'https://app.coldcopy.com/activate/123',
            },
          },
        ],
      }

      // Act
      const result = await sendBulkEmails(bulkOptions)

      // Assert
      expect(result.success).toBe(true)
      const command = mockSend.mock.calls[0][0]
      const destination = command.input.Destinations[0]
      expect(JSON.parse(destination.ReplacementTemplateData)).toEqual({
        firstName: 'John',
        activationLink: 'https://app.coldcopy.com/activate/123',
      })
    })
  })

  describe('Unsubscribe Link Generation', () => {
    it('should include unsubscribe header in raw email', async () => {
      // Arrange
      mockSend.mockResolvedValue({ MessageId: 'msg-123' })

      const emailOptions = {
        from: { email: 'sender@example.com', name: 'Sender' },
        to: ['recipient@example.com'],
        subject: 'Marketing Email',
        html: '<p>Marketing content</p>',
        text: 'Marketing content',
        headers: {
          'List-Unsubscribe': '<https://app.coldcopy.com/unsubscribe/lead-123>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }

      // Act
      await sendEmail(emailOptions)

      // Assert
      const command = mockSend.mock.calls[0][0]
      const rawEmail = command.input.RawMessage.Data.toString()
      expect(rawEmail).toContain('List-Unsubscribe: <https://app.coldcopy.com/unsubscribe/lead-123>')
      expect(rawEmail).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click')
    })
  })
})