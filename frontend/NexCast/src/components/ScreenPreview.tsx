import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ScreenPreviewProps {
  currentFrame: string | null;
  isSessionActive: boolean;
}

export const ScreenPreview = ({ currentFrame, isSessionActive }: ScreenPreviewProps) => {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-white">Screen Preview</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="aspect-video bg-black rounded-lg flex items-center justify-center overflow-hidden border border-gray-700">
          {currentFrame ? (
            <img
              src={currentFrame}
              alt="Screen capture"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-400">
                {isSessionActive
                  ? 'Waiting for first frame...'
                  : 'Start a session to see screen preview'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScreenPreview;
