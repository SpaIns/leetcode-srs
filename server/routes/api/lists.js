const List = require('../../models/Lists.js')
const User = require('../../models/User')
const Problem = require('../../models/Problem')

const express = require('express')
const { check, validationResult } = require('express-validator')
const auth = require('../../middleware/auth')

const router = express.Router()



// @route  POST api/lists
// @desc   Create a new list
// @access Private
router.post('/', [auth, [
    check('name', 'Lists must be named.').not().isEmpty(),
]], async (req, res) => {
    const validationErrors = validationResult(req)
    if (!validationErrors.isEmpty()) {
        // Failed a validation check, return our errors.
        return res.status(400).json({errors: validationErrors.array()})
    }

    // Request was validated, let's create our list
    try {
        //TODO: Eventually, should limit # of lists per user. 100?
        // Since we can make multiple lists with the same name, no need to check unqiueness
        // Likewise for problems contained within
        const {
            name,
            public
        } = req.body

        // Get the current user to make them the creator
        const user = await User.findById(req.user.id)
        // TODO: Should we check to ensure public is a bool?
        const newList = new List({
            name,
            public,
            creator: user,
        })

        const list = await newList.save()
        return res.json(list)
    } catch (error) {
        console.error(error.message)
        return res.status(500).send('Server Error')
    }
})


// @route  PUT api/lists/:id
// @desc   Update an existing list's non-Problem attributes
// @access Private
router.put('/:id', [auth],
async (req, res) => {
    try {
        const list = await List.findById(req.params.id)
        // Ensure our list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }

        const user = await User.findById(req.user.id)
        // Ensure that this user owns the list
        if (user._id.toString() != list.creator.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete a list you did not create.'}]})
        }
        // Ensure list isn't public - cannot rename a public list, or take private
        if (list.public) {
            return res.status(403).json({errors: [{msg: 'Cannot update a public list.'}]})
        }

        const {
            name,
            public
        } = req.body

        // Update the list
        if (name) {list.name = name}
        if (public) {list.public = public}

        // Save the updated list
        const updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error(error.message)
        return res.status(500).send('Server Error')
    }
})

// @route  DELETE api/lists/id
// @desc   Delete an existing list
// @access Private
router.delete('/:id', [auth],
async (req, res) => {
    try {
        // Get our User object
        const user = await User.findById(req.user.id)
        // Get our List object
        const list = await List.findById(req.params.id)

        // Ensure our list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        
        // Check that this list belongs to the user
        if (user._id.toString() != list.creator.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete a list you did not create.'}]})
        }
        // Check that this list is not public
        if (list.public) {
            // Do not allow deletion of public lists.
            // Other users may have this list in their list of lists, so
            // we want to ensure that we don't suddenly erase it from them.
            // Return forbidden request
            return res.status(403).json({errors: [{msg: 'Cannot delete a public list.'}]})
        }

        // Remove the list 
        await list.remove()

        return res.json({msg: 'List removed'})
    } catch (error) {
        console.error(error.message)
        return res.status(500).send('Server Error')
    }
})

// @route  PUT api/lists/add/list_id/problem_id
// @desc   Add a problem to a list
// @access Private
router.put('/add/:list_id/:problem_id', [auth],
async (req, res) => {
    try {
        // Get the list
        const list = await List.findById(req.params.list_id)
        // Ensure the list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Ensure it's created by user
        const user = await User.findById(req.user.id)
        if (list.creator.toString() != user._id.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete a list you did not create.'}]})
        }
        // Get problem
        const problem = await Problem.findOne({id: req.params.problem_id})
        // Ensure problem exists
        if (!problem) {
            return res.status(404).send({errors: [{msg: 'Problem not found.'}]})
        }
        // Ensure not already in list
        const inList = list.problems.find((curProb) => {
            return curProb._id.toString() === problem._id.toString()
        })
        if (inList) {
            // Already a part of the list, can't add twice.
            return res.status(409).json({errors: [{msg: 'Problem already a part of this list.'}]})
        }
        // Attach to list
        list.problems.push(problem)
        
        // Update our list
        updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error(error.message)
        return res.status(500).send('Server Error')
    }
})


// @route  PUT api/lists/remove/list_id/problem_id
// @desc   Remove a problem from a list
// @access Private
router.put('/remove/:list_id/:problem_id', [auth],
async (req, res) => {
    try {
        // Get the list
        const list = await List.findById(req.params.list_id)
        // Ensure the list exists
        if (!list) {
            return res.status(404).send({errors: [{msg: 'List not found.'}]})
        }
        // Ensure it's created by user
        const user = await User.findById(req.user.id)
        if (list.creator.toString() != user._id.toString()) {
            return res.status(401).json({errors: [{msg: 'Cannot delete a list you did not create.'}]})
        }
        // Get problem
        const problem = await Problem.findOne({id: req.params.problem_id})
        // Ensure problem exists
        if (!problem) {
            return res.status(404).send({errors: [{msg: 'Problem not found.'}]})
        }
        // Ensure problem is part of the list
        const index = list.problems.map(curProb=> curProb._id.toString() ).indexOf(problem._id.toString())
        if (index === -1) {
            // Not in the list, can't remove it
            return res.status(404).json({errors: [{msg: 'Problem not part of this list.'}]})
        }
        // Remove from the list
        list.problems.splice(index, 1)
        
        // Update our list
        updatedList = await list.save()
        return res.json(updatedList)
    } catch (error) {
        console.error(error.message)
        return res.status(500).send('Server Error')
    }
})


module.exports = router