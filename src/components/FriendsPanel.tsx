import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ isOpen, onClose }) => {
  const { gameData, addFriend, removeFriend } = useGame();
  const [friendName, setFriendName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddFriend = () => {
    if (friendName.trim()) {
      addFriend(friendName.trim());
      setFriendName('');
      setIsDialogOpen(false);
    }
  };

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
        className={`fixed right-0 top-[70px] w-[350px] max-w-full h-[calc(100vh-70px)] bg-surface border-l border-border p-6 z-50 transition-transform duration-300 overflow-y-auto ${
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
            </DialogHeader>
            <Input
              placeholder="Friend name"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              className="bg-black/30 border-border"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 gradient-accent" onClick={handleAddFriend}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          {gameData.friends.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No friends yet
            </div>
          ) : (
            gameData.friends.map((friend, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-4 bg-black/30 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      friend.status === 'online' ? 'bg-primary' : 'bg-muted-foreground'
                    }`}
                  />
                  <span>{friend.name}</span>
                </div>
                <button
                  onClick={() => removeFriend(index)}
                  className="text-accent hover:scale-110 transition-transform"
                >
                  ✖
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default FriendsPanel;
