' Copyright (c) 2026 Roku, Inc.
' SPDX-License-Identifier: MIT

sub init()
    print "BaseAppScene init"

    di = CreateObject("roDeviceInfo")
    uiResolution = di.GetUIResolution()

    print "uiResolution: "; uiResolution.name

    m.top.backgroundColor = "0x000000FF"

    solidtvRokuProof = m.top.findNode("solidtvRokuProof")
    if solidtvRokuProof <> invalid
        print "SolidtvRokuProof component found and initialized"
        solidtvRokuProof.setFocus(true)
    else
        print "ERROR: SolidtvRokuProof component (id solidtvRokuProof) not found; initial focus not set"
    end if
end sub
