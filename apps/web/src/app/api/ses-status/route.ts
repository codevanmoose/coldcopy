import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if AWS credentials are configured
    const config = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing',
      AWS_REGION: process.env.AWS_REGION ? `✅ ${process.env.AWS_REGION}` : '❌ Missing',
      SES_FROM_EMAIL: process.env.SES_FROM_EMAIL ? `✅ ${process.env.SES_FROM_EMAIL}` : '❌ Missing',
      SES_CONFIGURATION_SET: process.env.SES_CONFIGURATION_SET || 'Not configured',
    };

    const isConfigured = !!(
      process.env.AWS_ACCESS_KEY_ID && 
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION
    );

    if (!isConfigured) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'AWS SES is not configured yet',
        config,
        nextSteps: [
          '1. Follow the SES setup guide at /ses-setup-guide.md',
          '2. Add AWS credentials to Vercel environment variables',
          '3. Verify your domain (coldcopy.cc) in AWS SES',
          '4. Request production access to send to any email',
        ]
      });
    }

    // If we have credentials, try to connect
    try {
      const { SESClient, GetAccountSendingEnabledCommand } = await import('@aws-sdk/client-ses');
      
      const sesClient = new SESClient({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const sendingEnabled = await sesClient.send(new GetAccountSendingEnabledCommand({}));

      return NextResponse.json({
        status: 'connected',
        message: '✅ Successfully connected to AWS SES',
        config,
        ses: {
          sendingEnabled: sendingEnabled.Enabled ? '✅ Yes' : '❌ No',
          region: process.env.AWS_REGION,
        },
        nextSteps: [
          'Visit https://console.aws.amazon.com/ses/ to:',
          '- Check domain verification status',
          '- View sending statistics',
          '- Request production access if still in sandbox',
        ]
      });
      
    } catch (error: any) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to connect to AWS SES',
        error: error.message,
        config,
        troubleshooting: [
          '1. Verify your AWS credentials are correct',
          '2. Check that your IAM user has SES permissions',
          '3. Ensure you\'re using the correct AWS region',
          `4. Current region: ${process.env.AWS_REGION || 'not set'}`,
        ]
      });
    }
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}