// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleVoting {
    // Structure for a Candidate
    struct Candidate {
        string name;
        uint256 voteCount;
    }
    
    // Structure for a Poll
    struct Poll {
        string title;
        Candidate[] candidates;
        bool isActive;
    }

    // Store all polls
    Poll[] public polls;
    
    // Events to track actions
    event PollCreated(uint256 pollId, string title);
    event Voted(uint256 pollId, uint256 candidateId);

    // Create a new poll
    function createPoll(string memory _title, string[] memory _candidateNames) public returns (uint256) {
        Poll storage newPoll = polls.push();
        newPoll.title = _title;
        newPoll.isActive = true;
        
        // Add candidates
        for (uint i = 0; i < _candidateNames.length; i++) {
            newPoll.candidates.push(Candidate({
                name: _candidateNames[i],
                voteCount: 0
            }));
        }
        
        emit PollCreated(polls.length - 1, _title);
        return polls.length - 1;
    }
    
    // Vote for a candidate in a poll
    function vote(uint256 _pollId, uint256 _candidateId) public {
        require(_pollId < polls.length, "Poll does not exist");
        require(polls[_pollId].isActive, "Poll is not active");
        require(_candidateId < polls[_pollId].candidates.length, "Candidate does not exist");
        
        polls[_pollId].candidates[_candidateId].voteCount++;
        emit Voted(_pollId, _candidateId);
    }
    
    // End a poll
    function endPoll(uint256 _pollId) public {
        require(_pollId < polls.length, "Poll does not exist");
        polls[_pollId].isActive = false;
    }
    
    // Get poll details
    function getPoll(uint256 _pollId) public view returns (
        string memory title,
        bool isActive,
        string[] memory candidateNames,
        uint256[] memory voteCounts
    ) {
        require(_pollId < polls.length, "Poll does not exist");
        
        Poll storage poll = polls[_pollId];
        title = poll.title;
        isActive = poll.isActive;
        
        candidateNames = new string[](poll.candidates.length);
        voteCounts = new uint256[](poll.candidates.length);
        
        for (uint i = 0; i < poll.candidates.length; i++) {
            candidateNames[i] = poll.candidates[i].name;
            voteCounts[i] = poll.candidates[i].voteCount;
        }
    }
    
    // Get total number of polls
    function getPollCount() public view returns (uint256) {
        return polls.length;
    }
}