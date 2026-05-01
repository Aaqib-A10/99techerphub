import { prisma } from '@/lib/prisma';
import OnboardingForm from './form';

export default async function OnboardingPage({ params }: { params: { token: string } }) {
  const { token } = params;

  try {
    const submission = await prisma.onboardingSubmission.findUnique({
      where: { token },
    });

    if (!submission) {
      return (
        <div className="min-h-screen bg-core-greenSoft flex items-center justify-center p-4">
          <div className="bg-core-surface rounded-lg shadow-lg p-8 max-w-md text-center">
            <div className="text-core-roseFg text-4xl mb-4">!</div>
            <h1 className="text-2xl font-bold text-core-text mb-2">Link Expired</h1>
            <p className="text-core-text2">
              This onboarding link has expired. Please contact HR.
            </p>
          </div>
        </div>
      );
    }

    const isExpired = submission.tokenExpiresAt && new Date() > submission.tokenExpiresAt;

    if (isExpired) {
      return (
        <div className="min-h-screen bg-core-greenSoft flex items-center justify-center p-4">
          <div className="bg-core-surface rounded-lg shadow-lg p-8 max-w-md text-center">
            <div className="text-core-roseFg text-4xl mb-4">!</div>
            <h1 className="text-2xl font-bold text-core-text mb-2">Link Expired</h1>
            <p className="text-core-text2">
              This onboarding link has expired. Please contact HR.
            </p>
          </div>
        </div>
      );
    }

    // If candidate has submitted AND admin hasn't asked for changes, show thank-you.
    // If reviewStatus === 'NEEDS_REVISION', let them back into the form to edit.
    if (submission.isComplete && submission.reviewStatus !== 'NEEDS_REVISION') {
      return (
        <div className="min-h-screen bg-core-greenSoft flex items-center justify-center p-4">
          <div className="bg-core-surface rounded-lg shadow-lg p-8 max-w-md text-center">
            <div className="text-core-greenFg text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-core-text mb-2">Thank You!</h1>
            <p className="text-core-text2">
              Your onboarding submission has been received. We'll be in touch shortly.
            </p>
          </div>
        </div>
      );
    }

    return <OnboardingForm token={token} initialSubmission={submission} />;
  } catch (error) {
    console.error('Error fetching onboarding submission:', error);
    return (
      <div className="min-h-screen bg-core-greenSoft flex items-center justify-center p-4">
        <div className="bg-core-surface rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-core-roseFg text-4xl mb-4">!</div>
          <h1 className="text-2xl font-bold text-core-text mb-2">Error</h1>
          <p className="text-core-text2">
            An error occurred while loading the onboarding form. Please try again.
          </p>
        </div>
      </div>
    );
  }
}
