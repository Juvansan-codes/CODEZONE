import React, { useState } from 'react';
import { useFriendSystem } from '@/hooks/useFriendSystem';
import { useAuth } from '@/contexts/AuthContext';
import { X, UserPlus, Check, XIcon, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { 
    friends, 
    pendingRequests, 
    loading, 
    sendFriendRequest, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    removeFriend 
  } = useFriendSystem();
  
  const [friendId, setFriendId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleAddFriend = async () => {
    if (!friendId.trim()) {
      toast.error('Please enter a player ID');
      return;
    }

    // Validate format (username#XXXX)
    if (!friendId.includes('#')) {
      toast.error('Invalid format. Use username#1234');
      return;
    }

    setIsSending(true);
    const result = await sendFriendRequest(friendId.trim());
    setIsSending(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Friend request sent to ${result.username}!`);
      setFriendId('');
      setIsDialogOpen(false);
    }
  };

  const handleAccept = async (id: string) => {
    const result = await acceptFriendRequest(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Friend request accepted!');
    }
  };

  const handleReject = async (id: string) => {
    const result = await rejectFriendRequest(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.info('Friend request rejected');
    }
  };

  const handleRemove = async (id: string) => {
    const result = await removeFriend(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.info('Friend removed');
    }
  };

  const copyMyId = () => {
    if (profile?.unique_id) {
      navigator.clipboard.writeText(profile.unique_id);
      toast.success('Your ID copied to clipboard!');
    }
  };

  const incomingRequests = pendingRequests.filter((r) => !r.isSentByMe);
  const outgoingRequests = pendingRequests.filter((r) => r.isSentByMe);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-[70px] w-[380px] max-w-full h-[calc(100vh-70px)] bg-surface border-l border-border p-6 z-50 transition-transform duration-300 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-border">
          <h3 className="font-orbitron font-bold text-xl">Friends</h3>
          <button
            onClick={onClose}
            className="text-accent hover:scale-110 transition-transform"
          >
            <X size={24} />
          </button>
        </div>

        {/* My ID Card */}
        <div className="bg-black/30 border border-border rounded-lg p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-1">Your Player ID</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-primary font-bold">
              {profile?.unique_id || 'Loading...'}
            </span>
            <Button variant="ghost" size="sm" onClick={copyMyId}>
              <Copy size={14} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share this ID with friends to add you
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full mb-4 gradient-accent">
              <UserPlus className="mr-2" size={18} />
              Add Friend
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="font-orbitron">Add Friend</DialogTitle>
              <DialogDescription>
                Enter your friend's player ID (e.g., username#1234)
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="username#1234"
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
              className="bg-black/30 border-border font-mono"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 gradient-accent" 
                onClick={handleAddFriend}
                disabled={isSending}
              >
                {isSending ? <Loader2 className="animate-spin" size={18} /> : 'Send Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <Tabs defaultValue="friends" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="friends">
                Friends ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="requests">
                Requests ({incomingRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="space-y-2">
              {friends.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No friends yet. Add some!
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex justify-between items-center p-4 bg-black/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          friend.isOnline ? 'bg-green-500' : 'bg-muted-foreground'
                        }`}
                      />
                      <div>
                        <span className="font-medium">{friend.username}</span>
                        <p className="text-xs text-muted-foreground font-mono">
                          {friend.uniqueId}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(friend.id)}
                      className="text-accent hover:scale-110 transition-transform p-2"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              {/* Incoming */}
              {incomingRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold mb-2 text-primary">Incoming</h4>
                  <div className="space-y-2">
                    {incomingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex justify-between items-center p-4 bg-black/30 rounded-lg border border-primary/30"
                      >
                        <div>
                          <span className="font-medium">{request.username}</span>
                          <p className="text-xs text-muted-foreground font-mono">
                            {request.uniqueId}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary hover:bg-primary/20"
                            onClick={() => handleAccept(request.id)}
                          >
                            <Check size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-accent hover:bg-accent/20"
                            onClick={() => handleReject(request.id)}
                          >
                            <XIcon size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outgoing */}
              {outgoingRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold mb-2 text-muted-foreground">Pending</h4>
                  <div className="space-y-2">
                    {outgoingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex justify-between items-center p-4 bg-black/30 rounded-lg border border-border opacity-70"
                      >
                        <div>
                          <span className="font-medium">{request.username}</span>
                          <p className="text-xs text-muted-foreground">
                            Waiting for response...
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No pending requests
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
};

export default FriendsPanel;