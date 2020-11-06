import React, {useState, useEffect} from 'react'
import {NavLink} from 'react-router-dom'
import PropTypes from 'prop-types'
import classes from './Navbar.module.css'
import {connect} from 'react-redux'
import Modal from 'react-modal'
import Auth from '../Modals/Login/Auth'
import Button from '../UI/Button/Button'

/*
need links to:
    Main page
    Login/Logout
    Register (combine with login)
    Edit
    History
*/
const Navbar = props => {
    // State for the login modal
    const [loginOpen, setLoginOpen] = useState(false)

    // On reload, close Modal if it was open and we auth'd
    useEffect(() => {
        if (props.isAuth) {
            setLoginOpen(false)
        }
    }, [props.isAuth])

    // Open/close login modal
    const openLogin = (event) => {
        event.preventDefault()
        setLoginOpen(true)
        console.log('opened login')
    }
    const closeLogin = () => {
        setLoginOpen(false)
        console.log('login is closed')
    }

    // JSX
    return (
        <div className={classes.Navbar}>
            <div className={classes.Left}>
                {props.isAuth && <div className={classes.NavLink}>Settings</div>}
                {/* Link to settings modal*/}
            </div>
            <div className={classes.Center}>
                <NavLink to='/' className={classes.Title}>
                    LeetCode SRS
                </NavLink>
                {/* Under title link to next problem*/}
                {/* Under title link to List's create list*/}
                {props.isAuth && <NavLink to='/create-lists'>Create/Edit {props.user}'s Lists</NavLink>}
            </div>
            <div className={classes.Right}>
                {props.isAuth && <NavLink activeClassName={classes.active} to='/logout'>Logout</NavLink>}
                {!props.isAuth && <Button btnType="Success" clicked={openLogin}>Login/Register</Button>}
                <Modal
                    isOpen={loginOpen}
                    onAfterOpen={null}
                    onRequestClose={closeLogin}
                    contentLabel="Login Modal"
                >
                    <div>
                        <Button btnType="Success" clicked={closeLogin}>Back to Home</Button>
                    </div>
                    <div>
                        <Auth/>
                    </div>
                </Modal>
                {/* Set CSS so below is ... below the above*/}
                {props.isAuth && <NavLink className={classes.NavLink} to='/history'>History</NavLink> }
            </div> 
            {/* TODO: Use this to fix css module stuff <button >Test button. i should be blue.</button>*/}
            <div>
                {props.isAuth && <NavLink className={classes.NavLink} to='/view-problems'>View Problems</NavLink>}
            </div>
            <div>
                <NavLink className={classes.NavLink} to='/view-public-lists'>View Public Lists</NavLink>
            </div>

        </div>
    )
}

Navbar.propTypes = {
    isAuth: PropTypes.bool.isRequired,
}

const mapStateToProps = state => {
    return {
        isAuth: (state.auth.token !== null),
        user: state.auth.userId,  
    }
}

export default connect(mapStateToProps)(Navbar)