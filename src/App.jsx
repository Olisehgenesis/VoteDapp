import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, X, Vote, Eye, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import CONTRACT_ABI from "./contracts/vote.abi.json";

const CONTRACT_ADDRESS = '0xf95EF9B12c80bfc8B3C3252f68A2935BadAe78B8';

export default function VotingApp() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newCandidates, setNewCandidates] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [votingPollId, setVotingPollId] = useState(null);
  const [votingCandidateId, setVotingCandidateId] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Initialize clients with persistence
    useEffect(() => {
        const initClients = async () => {
          const public_client = createPublicClient({
            chain: baseSepolia,
            transport: http()
          });
          setPublicClient(public_client);
    
          if (typeof window.ethereum !== 'undefined') {
            const wallet_client = createWalletClient({
              chain: baseSepolia,
              transport: custom(window.ethereum)
            });
            setWalletClient(wallet_client);
            
            // Auto-connect if previously connected
            try {
              const [address] = await wallet_client.getAddresses();
              if (address) {
                const [confirmed] = await wallet_client.requestAddresses();
                setAccount(confirmed);
              }
            } catch (err) {
              console.error('Auto-connect failed:', err);
            }
          }
        };
        
        initClients();
      }, []);
    
      const [account, setAccount] = useState(null);
      
      async function connectWallet() {
        try {
          if (!walletClient) {
            throw new Error('Please install MetaMask');
          }
          const [address] = await walletClient.requestAddresses();
          setAccount(address);
          localStorage.setItem('walletConnected', 'true');
        } catch (err) {
          setError(err.message);
        }
      }
    
      async function disconnectWallet() {
        setAccount(null);
        localStorage.removeItem('walletConnected');
      }
    
      const loadPolls = async () => {
        if (!publicClient) return;
    
        try {
          setLoading(true);
          const pollCount = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getPollCount'
          });
    
          const loadedPolls = await Promise.all(
            Array.from({ length: Number(pollCount) }, async (_, i) => {
              const [title, isActive, candidateNames, voteCounts] = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getPoll',
                args: [i]
              });
    
              const candidates = candidateNames.map((name, index) => ({
                name,
                votes: Number(voteCounts[index])
              }));
    
              return {
                id: i,
                title,
                isActive,
                candidates
              };
            })
          );
          
          setPolls(loadedPolls);
        } catch (err) {
          setError("Failed to load polls: " + err.message);
        } finally {
          setLoading(false);
        }
      };
    
      useEffect(() => {
        if (publicClient) {
          loadPolls();
        }
      }, [publicClient]);
    
      const createPoll = async (e) => {
        e.preventDefault();
        if (!walletClient || !account) {
          setError('Please connect your wallet first');
          return;
        }
    
        try {
          setCreating(true);
          const filteredCandidates = newCandidates.filter(c => c.trim() !== '');
          
          const { request } = await publicClient.simulateContract({
            account,
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'createPoll',
            args: [newPollTitle, filteredCandidates]
          });
          
          const hash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash });
          
          setNewPollTitle('');
          setNewCandidates(['', '']);
          await loadPolls();
        } catch (err) {
          setError("Failed to create poll: " + err.message);
        } finally {
          setCreating(false);
        }
      };
    
      const vote = async (pollId, candidateId) => {
        if (!walletClient || !account) {
          setError('Please connect your wallet first');
          return;
        }
    
        try {
          setVotingPollId(pollId);
          setVotingCandidateId(candidateId);
          
          const { request } = await publicClient.simulateContract({
            account,
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'vote',
            args: [pollId, candidateId]
          });
          
          const hash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash });
          
          await loadPolls();
        } catch (err) {
          setError("Failed to vote: " + err.message);
        } finally {
          setVotingPollId(null);
          setVotingCandidateId(null);
        }
      };
    
      const endPoll = async (pollId) => {
        if (!walletClient || !account) {
          setError('Please connect your wallet first');
          return;
        }
    
        try {
          const { request } = await publicClient.simulateContract({
            account,
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'endPoll',
            args: [pollId]
          });
          
          const hash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash });
          
          await loadPolls();
        } catch (err) {
          setError("Failed to end poll: " + err.message);
        }
      };

  const PollDetailsCard = ({ poll }) => {
    if (!poll) return null;

    const totalVotes = poll.candidates.reduce((total, c) => total + c.votes, 0);

    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{poll.title}</CardTitle>
              <CardDescription>
                Total Votes: {totalVotes}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${poll.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={poll.isActive ? 'text-green-600' : 'text-red-600'}>
                {poll.isActive ? 'Active' : 'Ended'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {poll.candidates.map((candidate, index) => {
              const percentage = totalVotes > 0 
                ? (candidate.votes / totalVotes) * 100 
                : 0;
              
              return (
                <motion.div
                  key={index}
                  className="space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-sm text-gray-500">
                        {candidate.votes} votes ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    {poll.isActive && (
                      <Button
                        onClick={() => vote(poll.id, index)}
                        disabled={votingPollId === poll.id || !account}
                        variant={votingPollId === poll.id && votingCandidateId === index ? "secondary" : "default"}
                        size="sm"
                      >
                        {votingPollId === poll.id && votingCandidateId === index ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Voting...
                          </>
                        ) : (
                          <>
                            <Vote className="h-4 w-4 mr-2" />
                            Vote
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <Progress value={percentage} className="h-2" />
                </motion.div>
              );
            })}
          </div>
          {poll.isActive && (
            <div className="mt-6 pt-4 border-t flex justify-end">
              <Button 
                onClick={() => endPoll(poll.id)}
                disabled={!account}
                variant="outline"
              >
                End Poll
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const CreatePollDialog = () => (
    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Poll</DialogTitle>
          <DialogDescription>
            Create a new poll by entering a title and candidates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={createPoll} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Poll Title</label>
            <Input
              type="text"
              value={newPollTitle}
              onChange={(e) => setNewPollTitle(e.target.value)}
              placeholder="Enter poll title"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Candidates</label>
            <div className="space-y-3">
              {newCandidates.map((candidate, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2"
                >
                  <Input
                    value={candidate}
                    onChange={(e) => {
                      const updated = [...newCandidates];
                      updated[index] = e.target.value;
                      setNewCandidates(updated);
                    }}
                    placeholder={`Candidate ${index + 1}`}
                    required
                  />
                  {index > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setNewCandidates(newCandidates.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewCandidates([...newCandidates, ''])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Candidate
              </Button>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={creating || !account}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Poll'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading polls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/75 -mx-4 px-4 py-4 border-b">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Decentralized Voting
          </h1>
          <div className="flex items-center gap-4">
            {account ? (
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <Button variant="outline" onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={connectWallet}>
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </nav>
      
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative"
          >
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Polls</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!account}>
          <Plus className="h-4 w-4 mr-2" />
          Create Poll
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>All Polls</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Candidates</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polls.map(poll => (
                  <TableRow key={poll.id}>
                    <TableCell className="font-medium">{poll.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${poll.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={poll.isActive ? 'text-green-600' : 'text-red-600'}>
                          {poll.isActive ? 'Active' : 'Ended'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{poll.candidates.length}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPoll(poll)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {polls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No polls created yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedPoll && <PollDetailsCard poll={selectedPoll} />}
      </div>

      <CreatePollDialog />

      {/* Poll refresh button */}
      <div className="fixed bottom-4 right-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadPolls}
          className="shadow-lg"
        >
          <Loader2 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
}